package org.finos.calm.store.noop;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.finos.calm.store.SchemaVersionStore;

@ApplicationScoped
@Typed(NoOpSchemaVersionStore.class)
public class NoOpSchemaVersionStore implements SchemaVersionStore {

    @Override
    public int getSchemaVersion() {
        return Integer.MAX_VALUE;
    }

    @Override
    public void setSchemaVersion(int version) {
        // no-op — GitHub mode has no database to version
    }

    @Override
    public boolean acquireMigrationLock(String instanceId) {
        return true;
    }

    @Override
    public void releaseMigrationLock(String instanceId) {
        // no-op
    }

    @Override
    public boolean isMigrationLockHeld() {
        return false;
    }
}
