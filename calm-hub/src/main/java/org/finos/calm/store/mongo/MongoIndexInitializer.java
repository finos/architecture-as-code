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
 * Creates unique indexes on MongoDB collections at startup to prevent
 * duplicate entries from concurrent POST requests.
 * Only runs when calm.database.mode is "mongo" (the default).
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

    void onStart(@Observes StartupEvent ev) {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping MongoDB index creation (database mode: {})", databaseMode);
            return;
        }
        createUniqueIndexes();
    }

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
