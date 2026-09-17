package org.finos.calm.migration.steps;

import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;

@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoDocumentIndexStep implements SchemaMigrationStep {
    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoDocumentIndexStep(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 15;
    }

    @Override
    public void apply() {
        if ("mongo".equals(databaseMode)) {
            createIndexes();
        }
    }

    public void createIndexes() {
        IndexOptions unique = new IndexOptions().unique(true);
        database.getCollection("documents").createIndex(
                new Document("namespace", 1).append("documentType", 1).append("documentId", 1), unique);
        database.getCollection("documentVersions").createIndex(
                new Document("namespace", 1).append("documentType", 1).append("documentId", 1).append("version", 1), unique);
    }
}
