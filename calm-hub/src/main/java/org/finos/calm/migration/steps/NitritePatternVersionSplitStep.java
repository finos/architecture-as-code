package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;

/**
 * NitriteDB counterpart to {@link MongoPatternVersionSplitStep}: the same version 3 → 4
 * fan-out of {@code patterns} into per-pattern headers plus a {@code patternVersions}
 * collection.
 *
 * <p>Both steps declare {@code fromVersion() == 3} but never coexist — each is gated by
 * {@code @LookupIfProperty} on a different value of {@code calm.database.mode}, so exactly
 * one is a CDI bean in any given deployment.</p>
 *
 * <p>The fan-out itself lives in {@link NitriteVersionSplitMigration}, shared with every
 * other versioned type.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitritePatternVersionSplitStep implements SchemaMigrationStep {

    private final NitriteVersionSplitMigration migration;

    @Inject
    public NitritePatternVersionSplitStep(@StandaloneQualifier Nitrite db) {
        this.migration = new NitriteVersionSplitMigration(
                db, "patterns", "patternVersions", "patternId", "patterns", "Pattern");
    }

    @Override
    public int fromVersion() {
        return 3;
    }

    @Override
    public void apply() {
        migration.migrate();
    }
}
