package org.finos.calm.migration.steps;

import com.mongodb.client.MongoDatabase;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Splits the {@code controls} collection from one document per domain, holding a
 * double-nested {@code controls[].configurations[]} shape, into
 * {@code controls}/{@code controlVersions} (requirement) and
 * {@code controlConfigurations}/{@code controlConfigurationVersions} (configuration).
 *
 * <p>Version 13 → 14 of the schema, and the Control slice of
 * {@code calm-hub/decisions/0007-control-storage-header-version-split.md}. Claims the next
 * free {@code fromVersion()} as of this writing — {@code MongoAdrTitleBackfillStep} (10 → 11),
 * {@code MongoResourceMappingIndexStep} (11 → 12), and {@code MongoPatternLayoutIndexStep}
 * (12 → 13) have all already merged to {@code main}. This step must not ship before whatever
 * is genuinely latest on {@code main} at merge time, or it risks claiming a version another
 * in-flight step also claims. See ADR 0007's "Schema version" section.</p>
 *
 * <p>The fan-out itself lives in {@link MongoControlSplitMigration}; this class supplies the
 * version it applies at.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoControlVersionSplitStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoControlVersionSplitStep.class);

    private final MongoControlSplitMigration migration;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoControlVersionSplitStep(MongoDatabase database) {
        this.migration = new MongoControlSplitMigration(database);
    }

    @Override
    public int fromVersion() {
        return 13;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping control version split (database mode: {})", databaseMode);
            return;
        }
        migrate();
    }

    /**
     * Runs the migration unconditionally — no {@code databaseMode} check. Public for the same
     * reason as the other split steps': integration tests with a known-real MongoDB container
     * call it directly rather than faking the CDI-injected {@link #databaseMode}.
     */
    public void migrate() {
        migration.migrate();
    }

    /**
     * Replaces the old one-document-per-domain constraint with the four the new shape needs.
     * Public separately from {@link #migrate()} because integration-test infrastructure needs
     * a database whose indexes match the new shape without having any old-shape data to fan out.
     */
    public void transitionIndexes() {
        migration.transitionIndexes();
    }
}
