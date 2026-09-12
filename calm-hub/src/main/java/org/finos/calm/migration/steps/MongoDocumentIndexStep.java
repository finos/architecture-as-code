package org.finos.calm.migration.steps;

import com.mongodb.client.MongoDatabase;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.util.VersionScheme;

@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoDocumentIndexStep implements SchemaMigrationStep {
    private final MongoVersionSplitMigration migration;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoDocumentIndexStep(MongoDatabase database) {
        migration = new MongoVersionSplitMigration(database, "documents", "documentVersions", "documentId",
                "documents", "versions", "Document", VersionScheme.SEMANTIC,
                "documentType", "documentMarkdown", "namespace_1_documentType_1");
    }

    @Override
    public int fromVersion() {
        return 15;
    }

    @Override
    public void apply() {
        if ("mongo".equals(databaseMode)) {
            migrateAndCreateIndexes();
        }
    }

    public void migrateAndCreateIndexes() {
        migration.migrate();
    }

    public void createIndexes() {
        migration.transitionIndexes();
    }
}
