package org.finos.calm.migration.steps;

import com.mongodb.client.MongoDatabase;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Splits the {@code architectures} collection from one document per namespace into one
 * <em>header</em> document per architecture plus one <em>version</em> document per version
 * in the new {@code architectureVersions} collection.
 *
 * <p>Version 2 → 3 of the schema, and the Architecture slice of
 * {@code calm-hub/decisions/0001-versioned-artefact-storage.md}. The fan-out itself lives in
 * {@link MongoVersionSplitMigration}, which every versioned type shares; this class supplies
 * the collection and field names and the schema version it applies at.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoArchitectureVersionSplitStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoArchitectureVersionSplitStep.class);

    private final MongoVersionSplitMigration migration;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoArchitectureVersionSplitStep(MongoDatabase database) {
        this.migration = new MongoVersionSplitMigration(
                database, "architectures", "architectureVersions", "architectureId", "architectures", "Architecture");
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
        migration.migrate();
    }

    /**
     * Replaces the old one-document-per-namespace constraint with the two the new shape
     * needs. Public separately from {@link #migrate()} because integration-test
     * infrastructure needs a database whose indexes match the new shape without having any
     * old-shape data to fan out.
     */
    public void transitionIndexes() {
        migration.transitionIndexes();
    }
}
