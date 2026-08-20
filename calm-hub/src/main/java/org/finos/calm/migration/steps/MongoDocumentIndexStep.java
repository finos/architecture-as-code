package org.finos.calm.migration.steps;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;

import io.quarkus.arc.lookup.LookupIfProperty;

import jakarta.enterprise.context.ApplicationScoped;

import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Creates the unique document index for namespace and document type. */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoDocumentIndexStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoDocumentIndexStep.class);

    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoDocumentIndexStep(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 14;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping document index creation (database mode: {})", databaseMode);
            return;
        }
        createIndexes();
    }

    /** Creates the document index for startup and integration-test setup. */
    public void createIndexes() {
        MongoCollection<Document> documents = database.getCollection("documents");
        documents.createIndex(
                new Document("namespace", 1).append("documentType", 1),
                new IndexOptions().unique(true));
        LOG.info("Ensured unique index on documents.(namespace, documentType)");
    }
}
