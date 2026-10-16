package org.finos.calm.store.noop;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

class TestNoOpSchemaVersionStoreShould {

    private NoOpSchemaVersionStore store;

    @BeforeEach
    void setup() {
        store = new NoOpSchemaVersionStore();
    }

    @Test
    void return_max_value_for_schema_version() {
        assertThat(store.getSchemaVersion(), equalTo(Integer.MAX_VALUE));
    }

    @Test
    void not_throw_on_set_schema_version() {
        store.setSchemaVersion(42);
        assertThat(store.getSchemaVersion(), equalTo(Integer.MAX_VALUE));
    }

    @Test
    void always_acquire_migration_lock() {
        assertThat(store.acquireMigrationLock("instance-1"), is(true));
        assertThat(store.acquireMigrationLock("instance-2"), is(true));
    }

    @Test
    void not_throw_on_release_migration_lock() {
        store.releaseMigrationLock("instance-1");
    }

    @Test
    void never_report_migration_lock_held() {
        store.acquireMigrationLock("instance-1");
        assertThat(store.isMigrationLockHeld(), is(false));
    }
}
