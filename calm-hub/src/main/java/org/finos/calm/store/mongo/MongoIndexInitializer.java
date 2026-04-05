package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
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
 * This bean observes the Quarkus {@link io.quarkus.runtime.StartupEvent}, so indexes are
 * created (or confirmed) exactly once during application bootstrap. MongoDB's
 * {@code createIndex} is idempotent — if the index already exists with the same definition,
 * the call is a no-op.
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
 *       {@code standards.namespace}, {@code interfaces.namespace} (unique) — one document
 *       per namespace in each entity collection, containing an array of that entity type</li>
 *   <li>{@code controls.domain} (unique) — one document per domain, containing an array
 *       of controls</li>
 * </ul>
 *
 * <h2>Failure behaviour</h2>
 * If index creation fails (e.g. MongoDB is unreachable or the user lacks permissions),
 * the exception is caught and logged as a warning. The application will continue to start
 * but will <em>not</em> have duplicate-prevention guarantees until the indexes are created
 * (manually or on the next successful startup).
 *
 * @see MongoNamespaceStore
 * @see MongoDomainStore
 * @see MongoArchitectureStore
 */
@ApplicationScoped
public class MongoIndexInitializer {

    private static final Logger LOG = LoggerFactory.getLogger(MongoIndexInitializer.class);

    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoIndexInitializer(MongoDatabase database) {
        this.database = database;
    }

    /**
     * Quarkus lifecycle callback — invoked once during application startup.
     * Checks the configured database mode and creates unique indexes only when
     * running against MongoDB.
     */
    void onStart(@Observes StartupEvent ev) {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping MongoDB index creation (database mode: {})", databaseMode);
            return;
        }
        createUniqueIndexes();
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
     */
    private void createUniqueIndexes() {
        IndexOptions uniqueIndex = new IndexOptions().unique(true);

        try {
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

            // Namespace-scoped collections — one document per namespace
            for (String collection : new String[]{"architectures", "patterns", "flows", "standards", "interfaces"}) {
                database.getCollection(collection)
                        .createIndex(new Document("namespace", 1), uniqueIndex);
                LOG.info("Ensured unique index on {}.namespace", collection);
            }

            // Domain-scoped collection — one document per domain
            database.getCollection("controls")
                    .createIndex(new Document("domain", 1), uniqueIndex);
            LOG.info("Ensured unique index on controls.domain");
        } catch (Exception e) {
            LOG.warn("Failed to create MongoDB indexes — indexes may already exist or MongoDB is unavailable", e);
        }
    }
}
