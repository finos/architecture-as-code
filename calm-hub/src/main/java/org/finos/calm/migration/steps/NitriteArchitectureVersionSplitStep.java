package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.util.CanonicalVersion;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB counterpart to {@link MongoArchitectureVersionSplitStep}: the same version
 * 2 → 3 fan-out of {@code architectures} into per-architecture headers plus a
 * {@code architectureVersions} collection.
 *
 * <p>Both steps declare {@code fromVersion() == 2}, which {@code SchemaMigrationRunner}
 * would reject as a duplicate — but they never coexist. Each is gated by
 * {@code @LookupIfProperty} on a different value of {@code calm.database.mode}, so
 * exactly one is a CDI bean in any given deployment.</p>
 *
 * <h2>Two differences from the Mongo step</h2>
 * <ul>
 *   <li><b>No index work.</b> CalmHub creates no Nitrite indexes at all, so there is no
 *       one-document-per-namespace constraint to drop and no uniqueness to establish —
 *       {@code NitriteVersionDocumentStore} enforces it with a lock instead.</li>
 *   <li><b>Version content is a JSON string</b>, not a parsed document, matching how the
 *       Nitrite stores have always held it.</li>
 * </ul>
 *
 * <h2>Idempotency</h2>
 * As with the Mongo step: only documents that still carry the {@code architectures} array
 * are processed, writes go through a remove-then-insert on the target key rather than a
 * blind insert, and the old document is deleted only once its contents are rewritten.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteArchitectureVersionSplitStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteArchitectureVersionSplitStep.class);

    private static final String HEADER_COLLECTION = "architectures";
    private static final String VERSION_COLLECTION = "architectureVersions";
    private static final String ID_FIELD = "architectureId";
    private static final String ARRAY_FIELD = "architectures";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String VERSIONS_FIELD = "versions";

    private final NitriteCollection headerCollection;
    private final NitriteCollection versionCollection;

    @Inject
    public NitriteArchitectureVersionSplitStep(@StandaloneQualifier Nitrite db) {
        this.headerCollection = db.getCollection(HEADER_COLLECTION);
        this.versionCollection = db.getCollection(VERSION_COLLECTION);
    }

    @Override
    public int fromVersion() {
        return 2;
    }

    @Override
    public void apply() {
        List<Document> oldDocuments = new ArrayList<>();
        for (Document document : headerCollection.find()) {
            // Nitrite has no "field exists" filter as convenient as Mongo's, and the
            // collection is small enough that checking in memory costs nothing.
            if (document.get(ARRAY_FIELD) != null) {
                oldDocuments.add(document);
            }
        }

        int migratedArchitectures = 0;
        int migratedVersions = 0;
        for (Document oldDocument : oldDocuments) {
            String namespace = oldDocument.get(NAMESPACE_FIELD, String.class);
            List<Document> entries = new TypeSafeNitriteDocument<>(oldDocument, Document.class).getList(ARRAY_FIELD);
            if (entries != null) {
                for (Document entry : entries) {
                    migratedVersions += writeOneArchitecture(namespace, entry);
                    migratedArchitectures++;
                }
            }
            // By identity, not by a namespace filter: the headers just written share this
            // namespace, and a filtered delete would take them with it.
            headerCollection.remove(oldDocument);
        }

        LOG.info("Architecture version split complete: {} namespace document(s) fanned out into "
                        + "{} header(s) and {} version document(s)",
                oldDocuments.size(), migratedArchitectures, migratedVersions);
    }

    /**
     * @return how many version documents were written for this architecture.
     */
    private int writeOneArchitecture(String namespace, Document entry) {
        Integer resourceId = entry.get(ID_FIELD, Integer.class);
        Document storedVersions = entry.get(VERSIONS_FIELD, Document.class);
        int versionCount = storedVersions == null ? 0 : storedVersions.getFields().size();

        Filter headerFilter = Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(ID_FIELD).eq(resourceId));
        headerCollection.remove(headerFilter);
        headerCollection.insert(Document.createDocument()
                .put(NAMESPACE_FIELD, namespace)
                .put(ID_FIELD, resourceId)
                .put("name", entry.get("name", String.class))
                .put("description", entry.get("description", String.class))
                .put("versionCount", versionCount)
                .put("metadata", Document.createDocument()));

        if (storedVersions == null) {
            return 0;
        }
        for (String storedKey : storedVersions.getFields()) {
            // Same conversion the write path uses, so migrated data is addressable by
            // exactly the spelling the new store looks for.
            String version = CanonicalVersion.of(storedKey);
            versionCollection.remove(Filter.and(where(NAMESPACE_FIELD).eq(namespace),
                    where(ID_FIELD).eq(resourceId), where("version").eq(version)));
            versionCollection.insert(Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace)
                    .put(ID_FIELD, resourceId)
                    .put("version", version)
                    .put("content", storedVersions.get(storedKey, String.class))
                    .put("metadata", Document.createDocument()));
        }
        return storedVersions.getFields().size();
    }
}
