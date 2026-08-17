package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;

/**
 * NitriteDB counterpart to {@link MongoStandardVersionSplitStep}: the same version 5 → 6
 * fan-out of {@code standards} into per-standard headers plus a {@code standardVersions}
 * collection.
 *
 * <p>Both steps declare {@code fromVersion() == 5} but never coexist — each is gated by
 * {@code @LookupIfProperty} on a different value of {@code calm.database.mode}, so exactly
 * one is a CDI bean in any given deployment.</p>
 *
 * <p>The fan-out itself lives in {@link NitriteVersionSplitMigration}, shared with every
 * other versioned type.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteStandardVersionSplitStep implements SchemaMigrationStep {

    private final NitriteVersionSplitMigration migration;

    @Inject
    public NitriteStandardVersionSplitStep(@StandaloneQualifier Nitrite db) {
        this.migration = new NitriteVersionSplitMigration(
                db, "standards", "standardVersions", "standardId", "standards", "Standard");
    }

    @Override
    public int fromVersion() {
        return 5;
    }

    @Override
    public void apply() {
        migration.migrate();
    }
}
