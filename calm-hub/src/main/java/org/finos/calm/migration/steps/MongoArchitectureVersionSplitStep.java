package org.finos.calm.migration.steps;

import com.mongodb.MongoCommandException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.ReplaceOptions;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.util.CanonicalVersion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Splits the {@code architectures} collection from one document per namespace into one
 * <em>header</em> document per architecture plus one <em>version</em> document per version
 * in the new {@code architectureVersions} collection.
 *
 * <p>Version 2 → 3 of the schema. Implements the Architecture slice of
 * {@code calm-hub/decisions/0001-versioned-artefact-storage.md}; the other six versioned
 * types are migrated by their own later steps, which is what makes the rollout
 * incremental.</p>
 *
 * <h2>This is a 1 → N fan-out, not an in-place shrink</h2>
 * One old document holds an <em>array</em> of architectures, each with an embedded map of
 * every version's full content. One such document therefore becomes N headers plus M
 * version documents, and the original is deleted rather than edited down.
 *
 * <h2>Why the indexes have to move first</h2>
 * {@code MongoIndexInitializationStep} created a unique index on {@code namespace} alone,
 * which enforces exactly one {@code architectures} document per namespace — precisely the
 * old shape. Writing N headers for one namespace is impossible until it is gone. That step
 * is immutable (a committed migration step never changes, or fresh deployments would
 * silently diverge from existing ones), so the drop belongs here.
 *
 * <h2>Idempotency</h2>
 * {@link SchemaMigrationStep} asks steps to survive a partially-applied previous attempt,
 * because a failure leaves the schema version unchanged and the step is retried next
 * startup. Three things provide that here:
 * <ul>
 *   <li>The fan-out selects only documents that still have an {@code architectures} array,
 *       so migrated headers are never re-processed.</li>
 *   <li>Headers and versions are written with {@code replaceOne(upsert)}, so re-writing one
 *       that a previous attempt already created succeeds instead of failing on the unique
 *       index.</li>
 *   <li>The old document is deleted only after its headers and versions are written, so a
 *       crash mid-namespace leaves the source intact and the whole namespace is redone.</li>
 * </ul>
 * The index work is naturally idempotent: {@code createIndex} is a no-op when the index
 * already exists, and the drop tolerates the index being absent.
 *
 * <h2>Version keys</h2>
 * Old keys are dash-encoded ({@code 1-0-0}) because Mongo field names cannot contain a dot.
 * They are converted with {@link CanonicalVersion} — the same conversion the write path
 * uses — rather than a local {@code replace('-', '.')}, so migrated data is addressable by
 * exactly the spelling the new store looks for. Anything the version regex doesn't
 * recognise is carried across untouched rather than mangled into a new key.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoArchitectureVersionSplitStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoArchitectureVersionSplitStep.class);

    private static final String HEADER_COLLECTION = "architectures";
    private static final String VERSION_COLLECTION = "architectureVersions";
    private static final String ID_FIELD = "architectureId";
    private static final String ARRAY_FIELD = "architectures";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String VERSIONS_FIELD = "versions";

    /** The index {@code MongoIndexInitializationStep} created, in Mongo's default naming. */
    private static final String OLD_NAMESPACE_INDEX = "namespace_1";

    /** MongoDB's {@code IndexNotFound} error code. */
    private static final int INDEX_NOT_FOUND = 27;

    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoArchitectureVersionSplitStep(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 2;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping architecture version split (database mode: {})", databaseMode);
            return;
        }
        migrate();
    }

    /**
     * Runs the migration unconditionally — no {@code databaseMode} check. Public, like
     * {@code MongoIndexInitializationStep.createIndexes()} and for the same reason:
     * integration tests with a known-real MongoDB container call it directly rather than
     * faking the CDI-injected {@link #databaseMode} field that {@link #apply()} needs.
     */
    public void migrate() {
        transitionIndexes();
        fanOutNamespaceDocuments();
    }

    /**
     * Replaces the old one-document-per-namespace constraint with the two the new shape
     * needs. Public separately from {@link #migrate()} because integration-test
     * infrastructure needs a database whose indexes match the new shape without having
     * any old-shape data to fan out.
     */
    public void transitionIndexes() {
        MongoCollection<Document> headers = database.getCollection(HEADER_COLLECTION);
        dropOldNamespaceIndex(headers);

        IndexOptions unique = new IndexOptions().unique(true);
        headers.createIndex(new Document(NAMESPACE_FIELD, 1).append(ID_FIELD, 1), unique);
        LOG.info("Ensured unique index on {}.({}, {})", HEADER_COLLECTION, NAMESPACE_FIELD, ID_FIELD);

        database.getCollection(VERSION_COLLECTION).createIndex(
                new Document(NAMESPACE_FIELD, 1).append(ID_FIELD, 1).append("version", 1), unique);
        LOG.info("Ensured unique index on {}.({}, {}, version)", VERSION_COLLECTION, NAMESPACE_FIELD, ID_FIELD);
    }

    private void dropOldNamespaceIndex(MongoCollection<Document> headers) {
        try {
            headers.dropIndex(OLD_NAMESPACE_INDEX);
            LOG.info("Dropped the old unique index {}.{}", HEADER_COLLECTION, OLD_NAMESPACE_INDEX);
        } catch (MongoCommandException e) {
            if (e.getErrorCode() != INDEX_NOT_FOUND) {
                throw e;
            }
            // Already dropped by a previous attempt, or never created — either way the
            // constraint we need gone is gone, which is all this call is for.
            LOG.info("Old unique index {}.{} was already absent", HEADER_COLLECTION, OLD_NAMESPACE_INDEX);
        }
    }

    private void fanOutNamespaceDocuments() {
        MongoCollection<Document> headers = database.getCollection(HEADER_COLLECTION);
        MongoCollection<Document> versions = database.getCollection(VERSION_COLLECTION);

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
        headers.find(Filters.exists(ARRAY_FIELD))
                .projection(Projections.include("_id"))
                .forEach(document -> oldDocumentIds.add(document.get("_id")));

        int migratedArchitectures = 0;
        int migratedVersions = 0;
        for (Object oldDocumentId : oldDocumentIds) {
            Document oldDocument = headers.find(Filters.eq("_id", oldDocumentId)).first();
            if (oldDocument == null) {
                continue;
            }
            String namespace = oldDocument.getString(NAMESPACE_FIELD);
            for (Document entry : oldDocument.getList(ARRAY_FIELD, Document.class, List.of())) {
                migratedVersions += writeOneArchitecture(headers, versions, namespace, entry);
                migratedArchitectures++;
            }
            // Only once its contents are safely rewritten.
            headers.deleteOne(Filters.eq("_id", oldDocumentId));
        }

        LOG.info("Architecture version split complete: {} namespace document(s) fanned out into "
                        + "{} header(s) and {} version document(s)",
                oldDocumentIds.size(), migratedArchitectures, migratedVersions);
    }

    /**
     * @return how many version documents were written for this architecture.
     */
    private int writeOneArchitecture(MongoCollection<Document> headers,
                                     MongoCollection<Document> versions,
                                     String namespace,
                                     Document entry) {
        Integer resourceId = entry.getInteger(ID_FIELD);
        Document storedVersions = entry.get(VERSIONS_FIELD, Document.class);
        Map<String, String> keysByCanonicalVersion = collapseToCanonicalVersions(storedVersions, namespace, resourceId);

        ReplaceOptions upsert = new ReplaceOptions().upsert(true);

        Document header = new Document(NAMESPACE_FIELD, namespace)
                .append(ID_FIELD, resourceId)
                .append("name", entry.getString("name"))
                .append("description", entry.getString("description"))
                // The collapsed count, not the raw key count: two old keys can mean one
                // version, and a header claiming more versions than exist is exactly the
                // drift the denormalised counter is supposed to avoid.
                .append("versionCount", keysByCanonicalVersion.size())
                .append("metadata", new Document());
        headers.replaceOne(
                Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(ID_FIELD, resourceId)),
                header, upsert);

        for (Map.Entry<String, String> version : keysByCanonicalVersion.entrySet()) {
            Document versionDocument = new Document(NAMESPACE_FIELD, namespace)
                    .append(ID_FIELD, resourceId)
                    .append("version", version.getKey())
                    .append("content", storedVersions.get(version.getValue(), Document.class))
                    .append("metadata", new Document());
            versions.replaceOne(
                    Filters.and(Filters.eq(NAMESPACE_FIELD, namespace),
                            Filters.eq(ID_FIELD, resourceId),
                            Filters.eq("version", version.getKey())),
                    versionDocument, upsert);
        }
        return keysByCanonicalVersion.size();
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
                        storedKey, namespace, ID_FIELD, resourceId, alreadyMapped, version);
            }
        }
        return keysByCanonicalVersion;
    }
}
