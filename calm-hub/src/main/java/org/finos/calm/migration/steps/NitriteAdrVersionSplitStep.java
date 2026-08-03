package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;

/**
 * NitriteDB counterpart to {@link MongoAdrVersionSplitStep}: the same version 8 → 9
 * fan-out of {@code adrs} into per-adr headers plus a {@code adrVersions}
 * collection.
 *
 * <p>Both steps declare {@code fromVersion() == 8} but never coexist — each is gated by
 * {@code @LookupIfProperty} on a different value of {@code calm.database.mode}, so exactly
 * one is a CDI bean in any given deployment.</p>
 *
 * <p>The fan-out itself lives in {@link NitriteVersionSplitMigration}, shared with every
 * other versioned type.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteAdrVersionSplitStep implements SchemaMigrationStep {

    private final NitriteVersionSplitMigration migration;

    @Inject
    public NitriteAdrVersionSplitStep(@StandaloneQualifier Nitrite db) {
        this.migration = new NitriteVersionSplitMigration(
                db, "adrs", "adrVersions", "adrId", "adrs", "revisions", "ADR");
    }

    @Override
    public int fromVersion() {
        return 8;
    }

    @Override
    public void apply() {
        migration.migrate();
    }
}
