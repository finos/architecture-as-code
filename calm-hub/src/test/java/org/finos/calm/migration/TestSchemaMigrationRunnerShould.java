package org.finos.calm.migration;

import org.finos.calm.migration.steps.MongoIndexInitializationStep;
import org.finos.calm.migration.steps.NamespaceAccessBackfillStep;
import org.finos.calm.store.SchemaVersionStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Duration;
import java.util.List;
import java.util.function.LongConsumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestSchemaMigrationRunnerShould {

    @Mock
    SchemaVersionStore schemaVersionStore;

    @Mock
    MongoIndexInitializationStep mongoIndexInitializer;

    @Mock
    NamespaceAccessBackfillStep namespaceMigrationService;

    // A no-op sleeper so tests exercising onStart() don't pay the real lock-visibility delay.
    private static final LongConsumer NO_OP_SLEEPER = millis -> { };

    @BeforeEach
    void setup() {
        when(schemaVersionStore.acquireMigrationLock(anyString())).thenReturn(true);
        when(mongoIndexInitializer.fromVersion()).thenReturn(0);
        when(namespaceMigrationService.fromVersion()).thenReturn(1);
    }

    private SchemaMigrationRunner newRunner(List<SchemaMigrationStep> steps) {
        return new SchemaMigrationRunner(schemaVersionStore, steps, NO_OP_SLEEPER);
    }

    @Test
    void run_both_steps_in_order_and_reach_the_latest_version_from_zero() {
        when(schemaVersionStore.getSchemaVersion()).thenReturn(0);
        SchemaMigrationRunner runner = newRunner(List.of(mongoIndexInitializer, namespaceMigrationService));

        runner.onStart(null);

        InOrder inOrder = inOrder(mongoIndexInitializer, namespaceMigrationService, schemaVersionStore);
        inOrder.verify(mongoIndexInitializer).apply();
        inOrder.verify(schemaVersionStore).setSchemaVersion(1);
        inOrder.verify(namespaceMigrationService).apply();
        inOrder.verify(schemaVersionStore).setSchemaVersion(2);
        verify(schemaVersionStore).releaseMigrationLock(anyString());
    }

    @Test
    void skip_the_mongo_index_step_but_still_advance_when_not_registered() {
        when(schemaVersionStore.getSchemaVersion()).thenReturn(0);
        SchemaMigrationRunner runner = newRunner(List.of(namespaceMigrationService));

        runner.onStart(null);

        verify(mongoIndexInitializer, never()).apply();
        verify(schemaVersionStore).setSchemaVersion(1);
        verify(namespaceMigrationService).apply();
        verify(schemaVersionStore).setSchemaVersion(2);
        verify(schemaVersionStore).releaseMigrationLock(anyString());
    }

    @Test
    void only_run_the_namespace_step_when_starting_from_version_one() {
        when(schemaVersionStore.getSchemaVersion()).thenReturn(1);
        SchemaMigrationRunner runner = newRunner(List.of(mongoIndexInitializer, namespaceMigrationService));

        runner.onStart(null);

        verify(mongoIndexInitializer, never()).apply();
        verify(namespaceMigrationService).apply();
        verify(schemaVersionStore).setSchemaVersion(2);
        verify(schemaVersionStore, never()).setSchemaVersion(1);
        verify(schemaVersionStore).releaseMigrationLock(anyString());
    }

    @Test
    void skip_lock_acquisition_entirely_when_already_at_the_latest_version() {
        when(schemaVersionStore.getSchemaVersion()).thenReturn(2);
        SchemaMigrationRunner runner = newRunner(List.of(mongoIndexInitializer, namespaceMigrationService));

        runner.onStart(null);

        verify(mongoIndexInitializer, never()).apply();
        verify(namespaceMigrationService, never()).apply();
        verify(schemaVersionStore, never()).setSchemaVersion(anyInt());
        verify(schemaVersionStore, never()).acquireMigrationLock(anyString());
        verify(schemaVersionStore, never()).releaseMigrationLock(anyString());
    }

    @Test
    void skip_migration_entirely_when_the_lock_cannot_be_acquired() {
        when(schemaVersionStore.getSchemaVersion()).thenReturn(0);
        when(schemaVersionStore.acquireMigrationLock(anyString())).thenReturn(false);
        SchemaMigrationRunner runner = newRunner(List.of(mongoIndexInitializer, namespaceMigrationService));

        runner.onStart(null);

        verify(schemaVersionStore, never()).setSchemaVersion(anyInt());
        verify(schemaVersionStore, never()).releaseMigrationLock(anyString());
    }

    @Test
    void leave_the_lock_held_when_the_first_step_fails() {
        when(schemaVersionStore.getSchemaVersion()).thenReturn(0);
        doThrow(new RuntimeException("boom")).when(mongoIndexInitializer).apply();
        SchemaMigrationRunner runner = newRunner(List.of(mongoIndexInitializer, namespaceMigrationService));

        runner.onStart(null);

        verify(schemaVersionStore, never()).setSchemaVersion(anyInt());
        verify(namespaceMigrationService, never()).apply();
        verify(schemaVersionStore, never()).releaseMigrationLock(anyString());
    }

    @Test
    void advance_past_a_successful_step_but_leave_the_lock_held_when_a_later_step_fails() {
        when(schemaVersionStore.getSchemaVersion()).thenReturn(0);
        doThrow(new RuntimeException("boom")).when(namespaceMigrationService).apply();
        SchemaMigrationRunner runner = newRunner(List.of(mongoIndexInitializer, namespaceMigrationService));

        runner.onStart(null);

        verify(schemaVersionStore).setSchemaVersion(1);
        verify(schemaVersionStore, never()).setSchemaVersion(2);
        verify(schemaVersionStore, never()).releaseMigrationLock(anyString());
    }

    @Test
    void wait_longer_than_the_filter_cache_ttl_after_acquiring_the_lock_before_running_steps() {
        when(schemaVersionStore.getSchemaVersion()).thenReturn(0);
        StringBuilder callOrder = new StringBuilder();
        LongConsumer recordingSleeper = millis -> callOrder.append("sleep(").append(millis).append(");");
        doAnswer(invocation -> {
            callOrder.append("apply();");
            return null;
        }).when(mongoIndexInitializer).apply();
        SchemaMigrationRunner runner = new SchemaMigrationRunner(schemaVersionStore,
                List.of(mongoIndexInitializer, namespaceMigrationService), recordingSleeper);

        runner.onStart(null);

        long expectedMillis = SchemaMigrationInProgressFilter.CACHE_TTL.plus(Duration.ofSeconds(1)).toMillis();
        assertThat(callOrder.toString(), is("sleep(" + expectedMillis + ");apply();"));
    }

    @Test
    void fail_fast_at_construction_when_two_steps_declare_the_same_from_version() {
        when(namespaceMigrationService.fromVersion()).thenReturn(0);

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> new SchemaMigrationRunner(schemaVersionStore,
                        List.of(mongoIndexInitializer, namespaceMigrationService)));

        assertThat(exception.getMessage(), containsString("Duplicate SchemaMigrationStep"));
    }
}
