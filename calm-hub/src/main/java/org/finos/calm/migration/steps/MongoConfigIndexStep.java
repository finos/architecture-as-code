package org.finos.calm.migration.steps;

import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;

/**
 * Creates the unique indexes of the config collections. The {@code configDefaults} index also makes the upsert in
 * {@code MongoConfigStore#setDefault} keep one default per namespace and type when two writes race.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoConfigIndexStep implements SchemaMigrationStep {
    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoConfigIndexStep(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 16;
    }

    @Override
    public void apply() {
        if ("mongo".equals(databaseMode)) {
            createIndexes();
        }
    }

    public void createIndexes() {
        IndexOptions unique = new IndexOptions().unique(true);
        database.getCollection("configs").createIndex(
                new Document("namespace", 1).append("configType", 1).append("configId", 1), unique);
        database.getCollection("configVersions").createIndex(
                new Document("namespace", 1).append("configType", 1).append("configId", 1).append("version", 1), unique);
        database.getCollection("configDefaults").createIndex(
                new Document("namespace", 1).append("configType", 1), unique);
    }
}
