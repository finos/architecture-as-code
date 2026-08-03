package org.finos.calm.migration.steps;

import com.mongodb.MongoCommandException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.ReplaceOptions;
import org.bson.Document;
import org.finos.calm.store.util.CanonicalVersion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The MongoDB half of ADR 0001's per-type migration: split one document per namespace,
 * holding an array of resources each with an embedded map of every version's content, into
 * one <em>header</em> document per resource plus one <em>version</em> document per version
 * in a sibling {@code <type>Versions} collection.
 *
 * <p>Every versioned type performs the identical migration against different collection and
 * field names, so the logic lives here once and each type's {@code SchemaMigrationStep} is a
 * thin bean supplying those names and its {@code fromVersion()}. Extracted when Pattern
 * became the second type to need it — the alternative was seven near-identical copies, and
 * three separate reviews had already found the same defect surviving in one copy of a pair
 * after being fixed in the other.</p>
 *
 * <h2>This is a 1 → N fan-out, not an in-place shrink</h2>
 * One old document becomes N headers plus M version documents, and the original is deleted
 * rather than edited down.
 *
 * <h2>Why the indexes have to move first</h2>
 * {@code MongoIndexInitializationStep} created a unique index on {@code namespace} alone for
 * every entity collection, which enforces exactly one document per namespace — precisely the
 * old shape. Writing N headers for one namespace is impossible until it is gone. That step is
 * immutable, so the drop belongs in each per-type migration.
 *
 * <h2>Idempotency</h2>
 * {@code SchemaMigrationStep} asks steps to survive a partially-applied previous attempt,
 * because a failure leaves the schema version unchanged and the step is retried next startup.
 * Three things provide that:
 * <ul>
 *   <li>The fan-out selects only documents that still have the resource array, so migrated
 *       headers are never re-processed.</li>
 *   <li>Headers and versions are written with {@code replaceOne(upsert)}, so re-writing one a
 *       previous attempt already created succeeds instead of failing on the unique index.</li>
 *   <li>The old document is deleted only after its contents are written, so a crash
 *       mid-namespace leaves the source intact and the whole namespace is redone.</li>
 * </ul>
 * The index work is naturally idempotent: {@code createIndex} is a no-op when the index
 * already exists, and the drop tolerates the index being absent.
 */
public class MongoVersionSplitMigration {

    private static final Logger LOG = LoggerFactory.getLogger(MongoVersionSplitMigration.class);

    private static final String NAMESPACE_FIELD = "namespace";
    private static final String VERSION_FIELD = "version";

    /** The index {@code MongoIndexInitializationStep} created, in Mongo's default naming. */
    private static final String OLD_NAMESPACE_INDEX = "namespace_1";

    /** MongoDB's {@code IndexNotFound} error code. */
    private static final int INDEX_NOT_FOUND = 27;

    private final MongoDatabase database;
    private final String headerCollection;
    private final String versionCollection;
    private final String idField;
    private final String arrayField;
    private final String versionsField;
    private final String resourceLabel;

    /**
     * @param headerCollection  the existing per-type collection, which becomes the headers
     * @param versionCollection the new sibling collection (e.g. {@code patternVersions})
     * @param idField           the type's numeric id field (e.g. {@code patternId})
     * @param arrayField        the field holding the resource array on the old-shape
     *                          document — usually the collection name, but not always
     * @param resourceLabel     human-readable type name, used only in log messages
     */
    public MongoVersionSplitMigration(MongoDatabase database, String headerCollection, String versionCollection,
                                      String idField, String arrayField, String resourceLabel) {
        this(database, headerCollection, versionCollection, idField, arrayField, "versions", resourceLabel);
    }

    /**
     * @param versionsField the field holding the version map on each old-shape entry.
     *                      "versions" for every type but ADR, whose map is named "revisions".
     */
    public MongoVersionSplitMigration(MongoDatabase database, String headerCollection, String versionCollection,
                                      String idField, String arrayField, String versionsField, String resourceLabel) {
        this.database = database;
        this.headerCollection = headerCollection;
        this.versionCollection = versionCollection;
        this.idField = idField;
        this.arrayField = arrayField;
        this.versionsField = versionsField;
        this.resourceLabel = resourceLabel;
    }

    public void migrate() {
        transitionIndexes();
        fanOutNamespaceDocuments();
    }

    /** Replaces the old one-document-per-namespace constraint with the two the new shape needs. */
    public void transitionIndexes() {
        MongoCollection<Document> headers = database.getCollection(headerCollection);
        dropOldNamespaceIndex(headers);

        IndexOptions unique = new IndexOptions().unique(true);
        headers.createIndex(new Document(NAMESPACE_FIELD, 1).append(idField, 1), unique);
        LOG.info("Ensured unique index on {}.({}, {})", headerCollection, NAMESPACE_FIELD, idField);

        database.getCollection(versionCollection).createIndex(
                new Document(NAMESPACE_FIELD, 1).append(idField, 1).append(VERSION_FIELD, 1), unique);
        LOG.info("Ensured unique index on {}.({}, {}, version)", versionCollection, NAMESPACE_FIELD, idField);
    }

    private void dropOldNamespaceIndex(MongoCollection<Document> headers) {
        try {
            headers.dropIndex(OLD_NAMESPACE_INDEX);
            LOG.info("Dropped the old unique index {}.{}", headerCollection, OLD_NAMESPACE_INDEX);
        } catch (MongoCommandException e) {
            if (e.getErrorCode() != INDEX_NOT_FOUND) {
                throw e;
            }
            // Already dropped by a previous attempt, or never created — either way the
            // constraint we need gone is gone, which is all this call is for.
            LOG.info("Old unique index {}.{} was already absent", headerCollection, OLD_NAMESPACE_INDEX);
        }
    }

    private void fanOutNamespaceDocuments() {
        MongoCollection<Document> headers = database.getCollection(headerCollection);
        MongoCollection<Document> versions = database.getCollection(versionCollection);

        // Ids only, not the documents themselves. These are precisely the documents this
        // migration exists to break up — each up to MongoDB's 16MB ceiling, and several
        // times that once parsed into a Document — so holding every one of them in memory
        // at once is how a hub with a few large namespaces runs out of heap. An OOM here
        // is not a clean failure either: the step throws, the runner leaves the migration
        // lock held, and every instance sharing the database refuses requests until an
        // administrator clears it. So they are re-read and released one at a time.
        //
        // Only old-shape documents carry the array; headers written by a previous attempt
        // (or by the running application) don't, so re-running skips them.
        List<Object> oldDocumentIds = new ArrayList<>();
        headers.find(Filters.exists(arrayField))
                .projection(Projections.include("_id"))
                .forEach(document -> oldDocumentIds.add(document.get("_id")));

        int migratedResources = 0;
        int migratedVersions = 0;
        for (Object oldDocumentId : oldDocumentIds) {
            Document oldDocument = headers.find(Filters.eq("_id", oldDocumentId)).first();
            if (oldDocument == null) {
                continue;
            }
            String namespace = oldDocument.getString(NAMESPACE_FIELD);
            for (Document entry : oldDocument.getList(arrayField, Document.class, List.of())) {
                migratedVersions += writeOneResource(headers, versions, namespace, entry);
                migratedResources++;
            }
            // Only once its contents are safely rewritten.
            headers.deleteOne(Filters.eq("_id", oldDocumentId));
        }

        LOG.info("{} version split complete: {} namespace document(s) fanned out into "
                        + "{} header(s) and {} version document(s)",
                resourceLabel, oldDocumentIds.size(), migratedResources, migratedVersions);
    }

    /**
     * @return how many version documents were written for this resource.
     */
    private int writeOneResource(MongoCollection<Document> headers, MongoCollection<Document> versions,
                                 String namespace, Document entry) {
        Integer resourceId = entry.getInteger(idField);
        Document storedVersions = entry.get(versionsField, Document.class);
        Map<String, String> keysByCanonicalVersion = collapseToCanonicalVersions(storedVersions, namespace, resourceId);

        ReplaceOptions upsert = new ReplaceOptions().upsert(true);

        Document header = new Document(NAMESPACE_FIELD, namespace)
                .append(idField, resourceId)
                .append("name", entry.getString("name"))
                .append("description", entry.getString("description"))
                // The collapsed count, not the raw key count: two old keys can mean one
                // version, and a header claiming more versions than exist is exactly the
                // drift the denormalised counter is supposed to avoid.
                .append("versionCount", keysByCanonicalVersion.size())
                .append("metadata", new Document());
        headers.replaceOne(
                Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(idField, resourceId)),
                header, upsert);

        for (Map.Entry<String, String> version : keysByCanonicalVersion.entrySet()) {
            Document versionDocument = new Document(NAMESPACE_FIELD, namespace)
                    .append(idField, resourceId)
                    .append(VERSION_FIELD, version.getKey())
                    .append("content", contentOf(storedVersions, version.getValue(), namespace, resourceId))
                    .append("metadata", new Document());
            versions.replaceOne(
                    Filters.and(Filters.eq(NAMESPACE_FIELD, namespace),
                            Filters.eq(idField, resourceId),
                            Filters.eq(VERSION_FIELD, version.getKey())),
                    versionDocument, upsert);
        }
        return keysByCanonicalVersion.size();
    }

    /**
     * Reads one version's stored content, preserving whatever is there rather than casting.
     *
     * <p>The old shape's content is expected to be a parsed document, and the typed accessor
     * would throw {@code ClassCastException} on anything else — out of the migration, which
     * would abort the run with the schema lock still held and leave the whole hub refusing
     * requests over a single malformed document.</p>
     *
     * <p>The value is carried across unchanged rather than dropped or coerced: a migration is
     * the wrong place to discard data, and an operator can repair the document afterwards.
     * The warning is what tells them to.</p>
     */
    private Object contentOf(Document storedVersions, String key, String namespace, Integer resourceId) {
        Object content = storedVersions.get(key);
        if (!(content instanceof Document)) {
            LOG.warn("Version [{}] of {} [namespace={}, {}={}] holds content of type [{}] rather than a "
                            + "document. Migrating it unchanged so nothing is lost; repair the document "
                            + "if reads of that version do not behave.",
                    key, resourceLabel, namespace, idField, resourceId,
                    content == null ? "null" : content.getClass().getName());
        }
        return content;
    }

    /**
     * Maps each canonical version to the stored key it came from, keeping the first when
     * several collapse onto one.
     *
     * <p>The old shape could hold several keys meaning the same version. It wrote them via
     * {@code replace('.', '-')}, which folded {@code 1.0.0} and {@code 1-0-0} together but
     * left {@code 100} and {@code 1.00} — both accepted by {@code VERSION_REGEX} — as keys
     * of their own. All of them canonicalise to {@code 1.0.0}, and only one document can
     * exist per {@code (namespace, id, version)}, so collapsing is unavoidable rather than
     * a choice made here.</p>
     *
     * <p>What is a choice is doing it visibly: writing each key in turn would let the last
     * silently overwrite the earlier ones' content and still report every key in
     * {@code versionCount}. Logging at {@code WARN} names the discarded key so the loss is
     * recoverable from a backup, which a silent overwrite would not be.</p>
     */
    private Map<String, String> collapseToCanonicalVersions(Document storedVersions, String namespace, Integer resourceId) {
        Map<String, String> keysByCanonicalVersion = new LinkedHashMap<>();
        if (storedVersions == null) {
            return keysByCanonicalVersion;
        }
        for (String storedKey : storedVersions.keySet()) {
            // CanonicalVersion handles the dash spelling directly — VERSION_REGEX treats
            // both separators as interchangeable — so no replace('-', '.') first.
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
