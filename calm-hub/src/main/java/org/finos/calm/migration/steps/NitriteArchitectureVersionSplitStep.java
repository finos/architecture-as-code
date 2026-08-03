package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;

/**
 * NitriteDB counterpart to {@link MongoArchitectureVersionSplitStep}: the same version
 * 2 → 3 fan-out of {@code architectures} into per-architecture headers plus an
 * {@code architectureVersions} collection.
 *
 * <p>Both steps declare {@code fromVersion() == 2}, which {@code SchemaMigrationRunner}
 * would reject as a duplicate — but they never coexist. Each is gated by
 * {@code @LookupIfProperty} on a different value of {@code calm.database.mode}, so exactly
 * one is a CDI bean in any given deployment.</p>
 *
 * <p>The fan-out itself lives in {@link NitriteVersionSplitMigration}, shared by every
 * versioned type; this class supplies the collection and field names.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteArchitectureVersionSplitStep implements SchemaMigrationStep {

    private final NitriteVersionSplitMigration migration;

    @Inject
    public NitriteArchitectureVersionSplitStep(@StandaloneQualifier Nitrite db) {
        this.migration = new NitriteVersionSplitMigration(
                db, "architectures", "architectureVersions", "architectureId", "architectures", "Architecture");
    }

    @Override
    public int fromVersion() {
        return 2;
    }

    @Override
    public void apply() {
        migration.migrate();
    }
}
