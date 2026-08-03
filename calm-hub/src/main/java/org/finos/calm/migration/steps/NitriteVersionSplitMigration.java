package org.finos.calm.migration.steps;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.collection.NitriteId;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.store.util.CanonicalVersion;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB counterpart to {@link MongoVersionSplitMigration}: the same per-type fan-out of a
 * namespace-scoped collection into per-resource headers plus a {@code <type>Versions}
 * collection. Shared by every versioned type, with each type's
 * {@code SchemaMigrationStep} supplying the collection and field names.
 *
 * <h2>Two differences from the Mongo migration</h2>
 * <ul>
 *   <li><b>No index work.</b> CalmHub creates no Nitrite indexes at all, so there is no
 *       one-document-per-namespace constraint to drop and no uniqueness to establish —
 *       {@code NitriteVersionDocumentStore} enforces it with a lock instead.</li>
 *   <li><b>Version content is a JSON string</b>, not a parsed document, matching how the
 *       Nitrite stores have always held it.</li>
 * </ul>
 *
 * <h2>Idempotency</h2>
 * As with the Mongo migration: only documents that still carry the resource array are
 * processed, writes go through a remove-then-insert on the target key rather than a blind
 * insert, and the old document is deleted only once its contents are rewritten.
 */
public class NitriteVersionSplitMigration {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteVersionSplitMigration.class);

    private static final String NAMESPACE_FIELD = "namespace";
    private static final String VERSION_FIELD = "version";

    private final NitriteCollection headerCollection;
    private final NitriteCollection versionCollection;
    private final String idField;
    private final String arrayField;
    private final String versionsField;
    private final String resourceLabel;

    public NitriteVersionSplitMigration(Nitrite db, String headerCollection, String versionCollection,
                                        String idField, String arrayField, String resourceLabel) {
        this(db, headerCollection, versionCollection, idField, arrayField, "versions", resourceLabel);
    }

    /**
     * @param versionsField the field holding the version map on each old-shape entry.
     *                      "versions" for every type but ADR, whose map is named "revisions".
     */
    public NitriteVersionSplitMigration(Nitrite db, String headerCollection, String versionCollection,
                                      String idField, String arrayField, String versionsField, String resourceLabel) {
        this.headerCollection = db.getCollection(headerCollection);
        this.versionCollection = db.getCollection(versionCollection);
        this.idField = idField;
        this.arrayField = arrayField;
        this.versionsField = versionsField;
        this.resourceLabel = resourceLabel;
    }

    public void migrate() {
        // Ids only, matching the Mongo migration. These are precisely the documents this
        // exists to break up — each holding every version of every resource in a namespace —
        // so retaining them all as parsed Documents is how a hub with a few large namespaces
        // exhausts the heap. An OOM is not a clean failure either: the step throws and the
        // runner leaves the migration lock held.
        List<NitriteId> oldDocumentIds = new ArrayList<>();
        for (Document document : headerCollection.find()) {
            // Nitrite has no "field exists" filter as convenient as Mongo's, so old-shape
            // documents are told apart in memory — but only their ids are kept.
            if (document.get(arrayField) != null) {
                oldDocumentIds.add(document.getId());
            }
        }

        int migratedResources = 0;
        int migratedVersions = 0;
        for (NitriteId oldDocumentId : oldDocumentIds) {
            Document oldDocument = headerCollection.getById(oldDocumentId);
            if (oldDocument == null) {
                continue;
            }
            String namespace = oldDocument.get(NAMESPACE_FIELD, String.class);
            List<Document> entries = new TypeSafeNitriteDocument<>(oldDocument, Document.class).getList(arrayField);
            if (entries != null) {
                for (Document entry : entries) {
                    migratedVersions += writeOneResource(namespace, entry);
                    migratedResources++;
                }
            }
            // By identity, not by a namespace filter: the headers just written share this
            // namespace, and a filtered delete would take them with it.
            headerCollection.remove(oldDocument);
        }

        LOG.info("{} version split complete: {} namespace document(s) fanned out into "
                        + "{} header(s) and {} version document(s)",
                resourceLabel, oldDocumentIds.size(), migratedResources, migratedVersions);
    }

    /**
     * @return how many version documents were written for this resource.
     */
    private int writeOneResource(String namespace, Document entry) {
        Integer resourceId = entry.get(idField, Integer.class);
        Document storedVersions = entry.get(versionsField, Document.class);
        Map<String, String> keysByCanonicalVersion = collapseToCanonicalVersions(storedVersions, namespace, resourceId);

        Filter headerFilter = Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(idField).eq(resourceId));
        headerCollection.remove(headerFilter);
        headerCollection.insert(Document.createDocument()
                .put(NAMESPACE_FIELD, namespace)
                .put(idField, resourceId)
                .put("name", entry.get("name", String.class))
                .put("description", entry.get("description", String.class))
                // The collapsed count, not the raw key count — see collapseToCanonicalVersions.
                .put("versionCount", keysByCanonicalVersion.size())
                .put("metadata", Document.createDocument()));

        for (Map.Entry<String, String> version : keysByCanonicalVersion.entrySet()) {
            versionCollection.remove(Filter.and(where(NAMESPACE_FIELD).eq(namespace),
                    where(idField).eq(resourceId), where(VERSION_FIELD).eq(version.getKey())));
            versionCollection.insert(Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace)
                    .put(idField, resourceId)
                    .put(VERSION_FIELD, version.getKey())
                    .put("content", contentOf(storedVersions, version.getValue(), namespace, resourceId))
                    .put("metadata", Document.createDocument()));
        }
        return keysByCanonicalVersion.size();
    }

    /**
     * Reads one version's stored content, preserving whatever is there rather than casting.
     *
     * <p>The old shape's content is expected to be a JSON string, and the typed accessor
     * would throw {@code ClassCastException} on anything else — out of the migration, which
     * would abort the run with the schema lock still held and leave the whole hub refusing
     * requests over a single malformed document.</p>
     *
     * <p>The value is carried across unchanged rather than dropped or coerced: a migration
     * is the wrong place to discard data, and the read path now reports unreadable content
     * as not-found rather than failing, so the resource stays serviceable and an operator
     * can repair the document afterwards. The warning is what tells them to.</p>
     */
    private Object contentOf(Document storedVersions, String key, String namespace, Integer resourceId) {
        Object content = storedVersions.get(key);
        if (!(content instanceof String)) {
            LOG.warn("Version [{}] of {} [namespace={}, {}={}] holds content of type [{}] rather than a "
                            + "string. Migrating it unchanged; reads of it will report the version as "
                            + "not found until the document is repaired.",
                    key, resourceLabel, namespace, idField, resourceId,
                    content == null ? "null" : content.getClass().getName());
        }
        return content;
    }

    /**
     * Maps each canonical version to the stored key it came from, keeping the first when
     * several collapse onto one. See
     * {@link MongoVersionSplitMigration#collapseToCanonicalVersions} for why the old shape
     * can hold several keys meaning one version, and why the collapse is logged rather than
     * left to a silent overwrite.
     */
    private Map<String, String> collapseToCanonicalVersions(Document storedVersions, String namespace, Integer resourceId) {
        Map<String, String> keysByCanonicalVersion = new LinkedHashMap<>();
        if (storedVersions == null) {
            return keysByCanonicalVersion;
        }
        for (String storedKey : storedVersions.getFields()) {
            // Same conversion the write path uses, so migrated data is addressable by
            // exactly the spelling the new store looks for.
            String version = CanonicalVersion.of(storedKey);
            String alreadyMapped = keysByCanonicalVersion.putIfAbsent(version, storedKey);
            if (alreadyMapped != null) {
                LOG.warn("Discarding version key '{}' [namespace={}, {}={}] — it means the same "
                                + "version as '{}' ({}), which the new shape stores once. The "
                                + "discarded content is only recoverable from a backup.",
                        storedKey, namespace, idField, resourceId, alreadyMapped, version);
            }
        }
        return keysByCanonicalVersion;
    }
}
