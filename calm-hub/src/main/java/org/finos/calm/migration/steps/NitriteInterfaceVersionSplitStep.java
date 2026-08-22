package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;

/**
 * NitriteDB counterpart to {@link MongoInterfaceVersionSplitStep}: the same version 6 → 7
 * fan-out of {@code interfaces} into per-interface headers plus a {@code interfaceVersions}
 * collection.
 *
 * <p>Both steps declare {@code fromVersion() == 6} but never coexist — each is gated by
 * {@code @LookupIfProperty} on a different value of {@code calm.database.mode}, so exactly
 * one is a CDI bean in any given deployment.</p>
 *
 * <p>The fan-out itself lives in {@link NitriteVersionSplitMigration}, shared with every
 * other versioned type.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteInterfaceVersionSplitStep implements SchemaMigrationStep {

    private final NitriteVersionSplitMigration migration;

    @Inject
    public NitriteInterfaceVersionSplitStep(@StandaloneQualifier Nitrite db) {
        this.migration = new NitriteVersionSplitMigration(
                db, "interfaces", "interfaceVersions", "interfaceId", "interfaces", "Interface");
    }

    @Override
    public int fromVersion() {
        return 6;
    }

    @Override
    public void apply() {
        migration.migrate();
    }
}
