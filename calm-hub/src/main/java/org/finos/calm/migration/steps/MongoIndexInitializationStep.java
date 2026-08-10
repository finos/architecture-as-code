package org.finos.calm.migration.steps;

import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.mongo.MongoArchitectureStore;
import org.finos.calm.store.mongo.MongoDomainStore;
import org.finos.calm.store.mongo.MongoNamespaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Creates unique indexes on MongoDB collections at application startup to enforce data integrity
 * and prevent duplicate entries caused by concurrent POST requests.
 *
 * <h2>Why unique indexes?</h2>
 * Without database-level unique constraints, two concurrent POST requests could both pass
 * application-level existence checks and insert duplicate records. MongoDB unique indexes
 * make the second insert fail atomically with a {@code DUPLICATE_KEY} error, which individual
 * store classes catch and translate into domain-specific exceptions
 * (e.g. {@code NamespaceAlreadyExistsException}).
 *
 * <h2>Lifecycle</h2>
 * This is a {@link SchemaMigrationStep}, run once by
 * {@code org.finos.calm.migration.SchemaMigrationRunner} as part of the version 0 → 1
 * schema migration. MongoDB's {@code createIndex} is idempotent — if the index already
 * exists with the same definition, the call is a no-op.
 *
 * <h2>Conditional execution</h2>
 * Index creation only runs when {@code calm.database.mode} is {@code "mongo"} (the default).
 * In standalone/Nitrite mode the indexes are irrelevant - Nitrite stores use
 * {@link java.util.concurrent.locks.ReentrantLock} for concurrency control instead.
 *
 * <h2>Index inventory</h2>
 * <ul>
 *   <li>{@code namespaces.name} (unique) — one document per namespace name</li>
 *   <li>{@code domains.name} (unique) — one document per domain name</li>
 *   <li>{@code schemas.version} (unique) — one document per schema version string</li>
 *   <li>{@code architectures.namespace}, {@code patterns.namespace}, {@code flows.namespace},
 *       {@code timelines.namespace}, {@code standards.namespace}, {@code interfaces.namespace},
 *       {@code adrs.namespace}, {@code decorators.namespace} (unique) — one document
 *       per namespace in each entity collection, containing an array of that entity type.
 *       {@code layouts} is deliberately not in this list — see {@link MongoLayoutIndexStep}</li>
 *   <li>{@code controls.domain} (unique) — one document per domain, containing an array
 *       of controls</li>
 *   <li>{@code userAccess.(username, namespace, permission)} and
 *       {@code userAccess.(username, domain, permission)} (unique, partial) — prevent
 *       duplicate grants; partial on the presence of {@code namespace}/{@code domain}
 *       respectively since a grant document has exactly one of the two</li>
 *   <li>{@code auditLogs.(namespace, entityType, entityId, timestamp)},
 *       {@code auditLogs.(domain, entityType, entityId, timestamp)},
 *       {@code auditLogs.(actor, timestamp)}, and {@code auditLogs.timestamp} (all
 *       non-unique) — the audit trail is append-only with no uniqueness invariant to
 *       protect; these indexes only support the lookup shapes
 *       {@link org.finos.calm.store.AuditLogStore}'s internal {@code query()} method
 *       is expected to use</li>
 * </ul>
 *
 * <h2>Failure behaviour</h2>
 * If index creation fails (e.g. MongoDB is unreachable, the operation times out, or the user
 * lacks permissions), the exception is <em>not</em> caught here — it propagates out of
 * {@link #apply()} to {@code SchemaMigrationRunner}, which is what actually decides what
 * "failed" means for a migration step (see that class's javadoc): the schema version isn't
 * advanced and the migration lock is left held, so this step is retried on the next startup
 * instead of the migration being silently marked successful with indexes that were never
 * created. Swallowing the exception here would mean that a single transient failure could
 * permanently and silently disable duplicate-prevention for a deployment's entire lifetime,
 * since {@code fromVersion() == 0} only ever runs once.
 *
 * <h2>Not run under {@code @QuarkusTest}</h2>
 * This step does not run in test mode (see {@code SchemaMigrationRunner}'s javadoc on why
 * {@code LaunchMode.TEST} can't be used to decide that here). The handful of real-MongoDB
 * {@code -P integration} tests that need these indexes to exist (e.g. {@code MongoDomainIntegration}
 * testing duplicate-key rejection) call {@link #createIndexes()} directly against their own
 * TestContainers-provisioned database, before the Quarkus application under test even starts
 * — see {@code src/integration-test/java/integration/EndToEndResource.java}.
 *
 * @see MongoNamespaceStore
 * @see MongoDomainStore
 * @see MongoArchitectureStore
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoIndexInitializationStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoIndexInitializationStep.class);

    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoIndexInitializationStep(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 0;
    }

    /**
     * Checks the configured database mode and creates unique indexes only when
     * running against MongoDB.
     */
    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping MongoDB index creation (database mode: {})", databaseMode);
            return;
        }
        createIndexes();
    }

    /**
     * Creates every index this step manages, unconditionally — no {@code databaseMode} check.
     * Public (unlike the two methods it delegates to) specifically so integration-test
     * infrastructure with a known-real MongoDB container can call it directly, without needing
     * to fake the CDI-injected {@link #databaseMode} field the way {@link #apply()} requires.
     */
    public void createIndexes() {
        createUniqueIndexes();
        createAuditIndexes();
    }

    /**
     * Creates unique single-field indexes on every collection that needs duplicate prevention.
     * <p>
     * Three categories of indexes are created:
     * <ol>
     *   <li><b>Top-level entity collections</b> (namespaces, domains, schemas) —
     *       prevent two documents with the same name/version from being inserted.</li>
     *   <li><b>Namespace-scoped collections</b> (architectures, patterns, flows, standards,
     *       interfaces) — ensure exactly one document per namespace. Each document contains
     *       an array of entities; new entities are appended via {@code $push} with upsert.</li>
     *   <li><b>Domain-scoped collection</b> (controls) — ensure exactly one document per
     *       domain, following the same nested-array pattern.</li>
     * </ol>
     * Throws (rather than catching internally) on the first failure — see the class javadoc's
     * "Failure behaviour" section for why.
     */
    private void createUniqueIndexes() {
        IndexOptions uniqueIndex = new IndexOptions().unique(true);

        // Top-level entity collections — prevent duplicate names/versions
        database.getCollection("namespaces")
                .createIndex(new Document("name", 1), uniqueIndex);
        LOG.info("Ensured unique index on namespaces.name");

        database.getCollection("domains")
                .createIndex(new Document("name", 1), uniqueIndex);
        LOG.info("Ensured unique index on domains.name");

        database.getCollection("schemas")
                .createIndex(new Document("version", 1), uniqueIndex);
        LOG.info("Ensured unique index on schemas.version");

        // Namespace-scoped collections — one document per namespace. layouts is deliberately
        // excluded: it is a flat one-document-per-(namespace, architectureId) collection, not
        // one document per namespace holding an array — see MongoLayoutIndexStep.
        for (String collection : new String[]{"architectures", "patterns", "flows", "timelines", "standards", "interfaces", "adrs", "decorators"}) {
            database.getCollection(collection)
                    .createIndex(new Document("namespace", 1), uniqueIndex);
            LOG.info("Ensured unique index on {}.namespace", collection);
        }

        // Domain-scoped collection — one document per domain
        database.getCollection("controls")
                .createIndex(new Document("domain", 1), uniqueIndex);
        LOG.info("Ensured unique index on controls.domain");

        // Resource mappings — unique (namespace, resourceType, customId) and reverse lookup
        // index. resourceType is part of the key so the same customId can be reused across
        // different resource types (e.g. a pattern and an architecture can both be "repo") —
        // see MongoResourceMappingIndexStep for the migration that carries existing deployments
        // to this shape.
        database.getCollection("resource_mappings")
                .createIndex(new Document("namespace", 1).append("resourceType", 1).append("customId", 1), uniqueIndex);
        LOG.info("Ensured unique index on resource_mappings.(namespace, resourceType, customId)");

        database.getCollection("resource_mappings")
                .createIndex(new Document("namespace", 1).append("resourceType", 1).append("numericId", 1));
        LOG.info("Ensured index on resource_mappings.(namespace, resourceType, numericId)");

        // userAccess grants — partial unique indexes so identical concurrent grants dedupe.
        // Two partials (not one compound index) because namespace-scoped and domain-scoped
        // grant documents don't share a discriminating field.
        database.getCollection("userAccess").createIndex(
                new Document("username", 1).append("namespace", 1).append("permission", 1),
                new IndexOptions().unique(true)
                        .partialFilterExpression(new Document("namespace", new Document("$exists", true))));
        LOG.info("Ensured unique partial index on userAccess.(username, namespace, permission)");

        database.getCollection("userAccess").createIndex(
                new Document("username", 1).append("domain", 1).append("permission", 1),
                new IndexOptions().unique(true)
                        .partialFilterExpression(new Document("domain", new Document("$exists", true))));
        LOG.info("Ensured unique partial index on userAccess.(username, domain, permission)");
    }

    /**
     * Creates non-unique lookup indexes on the {@code auditLogs} collection.
     * <p>
     * Unlike {@link #createUniqueIndexes()}, none of these enforce uniqueness — the
     * audit trail is append-only and every record is independent, so there is no
     * duplicate-prevention concern here. These indexes only support efficient lookups
     * for {@link org.finos.calm.store.AuditLogStore}'s internal {@code query()} method.
     * Throws (rather than catching internally) on the first failure — see the class javadoc's
     * "Failure behaviour" section for why.
     */
    private void createAuditIndexes() {
        database.getCollection("auditLogs")
                .createIndex(new Document("namespace", 1).append("entityType", 1)
                        .append("entityId", 1).append("timestamp", -1));
        LOG.info("Ensured index on auditLogs.(namespace, entityType, entityId, timestamp)");

        database.getCollection("auditLogs")
                .createIndex(new Document("domain", 1).append("entityType", 1)
                        .append("entityId", 1).append("timestamp", -1));
        LOG.info("Ensured index on auditLogs.(domain, entityType, entityId, timestamp)");

        database.getCollection("auditLogs")
                .createIndex(new Document("actor", 1).append("timestamp", -1));
        LOG.info("Ensured index on auditLogs.(actor, timestamp)");

        database.getCollection("auditLogs")
                .createIndex(new Document("timestamp", -1));
        LOG.info("Ensured index on auditLogs.timestamp");
    }
}
