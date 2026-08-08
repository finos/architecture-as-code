package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;

/**
 * NitriteDB counterpart to {@link MongoControlVersionSplitStep}: the same version 13 → 14
 * fan-out of {@code controls} into the requirement and configuration header/version
 * collection pairs.
 *
 * <p>Both steps declare {@code fromVersion() == 13} but never coexist — each is gated by
 * {@code @LookupIfProperty} on a different value of {@code calm.database.mode}, so exactly
 * one is a CDI bean in any given deployment.</p>
 *
 * <p>The fan-out itself lives in {@link NitriteControlSplitMigration}.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteControlVersionSplitStep implements SchemaMigrationStep {

    private final NitriteControlSplitMigration migration;

    @Inject
    public NitriteControlVersionSplitStep(@StandaloneQualifier Nitrite db) {
        this.migration = new NitriteControlSplitMigration(db);
    }

    @Override
    public int fromVersion() {
        return 13;
    }

    @Override
    public void apply() {
        migration.migrate();
    }
}
