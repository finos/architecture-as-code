package org.finos.calm.migration.steps;

import com.mongodb.client.MongoDatabase;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Splits the {@code interfaces} collection from one document per namespace into one
 * <em>header</em> document per interface plus one <em>version</em> document per version in the
 * new {@code interfaceVersions} collection.
 *
 * <p>Version 3 → 4 of the schema, and the Interface slice of
 * {@code calm-hub/decisions/0001-versioned-artefact-storage.md}. A separate step from
 * Architecture's rather than an edit to it, because a committed {@code SchemaMigrationStep}
 * is immutable: a deployment already past version 6 never re-runs it, so changing it would
 * alter fresh deployments only and silently diverge them from existing ones.</p>
 *
 * <p>The fan-out itself lives in {@link MongoVersionSplitMigration}, shared with every other
 * versioned type; this class supplies the collection and field names and the version it
 * applies at.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoInterfaceVersionSplitStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoInterfaceVersionSplitStep.class);

    private final MongoVersionSplitMigration migration;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoInterfaceVersionSplitStep(MongoDatabase database) {
        this.migration = new MongoVersionSplitMigration(
                database, "interfaces", "interfaceVersions", "interfaceId", "interfaces", "Interface");
    }

    @Override
    public int fromVersion() {
        return 6;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping interface version split (database mode: {})", databaseMode);
            return;
        }
        migrate();
    }

    /**
     * Runs the migration unconditionally — no {@code databaseMode} check. Public for the
     * same reason as the Architecture step's: integration tests with a known-real MongoDB
     * container call it directly rather than faking the CDI-injected {@link #databaseMode}.
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
