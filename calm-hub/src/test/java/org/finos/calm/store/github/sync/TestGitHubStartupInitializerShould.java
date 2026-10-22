package org.finos.calm.store.github.sync;

import io.quarkus.runtime.StartupEvent;
import org.eclipse.microprofile.context.ManagedExecutor;
import org.finos.calm.observability.GitHubMetrics;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestGitHubStartupInitializerShould {

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private GitHubMetrics metrics;

    @Mock
    private ManagedExecutor executor;

    @BeforeEach
    void setup() {
        // Make executor.runAsync execute the Runnable immediately (synchronously for testing)
        when(executor.runAsync(any(Runnable.class))).thenAnswer(invocation -> {
            Runnable task = invocation.getArgument(0);
            task.run();
            return CompletableFuture.completedFuture(null);
        });
    }

    private GitHubStartupInitializer initializerFor(Optional<List<String>> namespaceConfigs, String databaseMode) {
        return new GitHubStartupInitializer(cloneManager, registryService, metrics, executor, namespaceConfigs, databaseMode);
    }

    @Test
    void skip_when_no_namespaces_configured() {
        GitHubStartupInitializer initializer = initializerFor(Optional.empty(), "github");

        initializer.onStart(new StartupEvent());

        verify(cloneManager, never()).cloneAll();
        verify(registryService, never()).rebuild(any());
    }

    @Test
    void skip_entirely_when_database_mode_is_not_github() {
        // @LookupIfProperty only gates @Inject/Instance<T> resolution, not @Observes
        // invocation once the bean exists - this guard is what actually stops onStart()
        // from registering namespaces and cloning in, say, mongo mode.
        GitHubStartupInitializer initializer = initializerFor(
                Optional.of(List.of("finos|finos/architecture-as-code|main")), "mongo");

        initializer.onStart(new StartupEvent());

        verify(cloneManager, never()).registerNamespace(any(), any(), any(), any());
        verify(cloneManager, never()).cloneAll();
        verify(registryService, never()).rebuild(any());
    }

    @Test
    void register_namespaces_and_clone() {
        GitHubStartupInitializer initializer = initializerFor(Optional.of(List.of(
                "finos|finos/architecture-as-code|main",
                "team|my-org/team-repo"
        )), "github");
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of(
                "finos", Path.of("/tmp/finos"),
                "team", Path.of("/tmp/team")
        ));
        when(cloneManager.getState()).thenReturn(GitHubCloneManager.State.READY);

        initializer.onStart(new StartupEvent());

        verify(cloneManager).registerNamespace("finos", "finos/architecture-as-code", "main", Set.of());
        verify(cloneManager).registerNamespace("team", "my-org/team-repo", "main", Set.of());
        verify(cloneManager).cloneAll();
        verify(registryService).rebuild(any());
        verify(metrics).recordSyncSuccess(any());
        verify(metrics, never()).recordSyncFailure(any());
    }

    @Test
    void skip_invalid_entries() {
        GitHubStartupInitializer initializer = initializerFor(Optional.of(List.of("invalid-no-pipe")), "github");
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of());

        initializer.onStart(new StartupEvent());

        verify(cloneManager, never()).registerNamespace(any(), any(), any(), any());
    }

    @Test
    void parse_access_groups_from_namespace_config() {
        GitHubStartupInitializer initializer = initializerFor(Optional.of(List.of(
                "finos|finos/repo|main|group-a;group-b"
        )), "github");
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of(
                "finos", Path.of("/tmp/finos")
        ));

        initializer.onStart(new StartupEvent());

        verify(cloneManager).registerNamespace("finos", "finos/repo", "main",
                Set.of("group-a", "group-b"));
    }

    @Test
    void handle_clone_failure_gracefully() {
        GitHubStartupInitializer initializer = initializerFor(
                Optional.of(List.of("finos|finos/repo|main")), "github");
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of());
        doThrow(new RuntimeException("clone failed")).when(cloneManager).cloneAll();

        initializer.onStart(new StartupEvent());

        verify(cloneManager).cloneAll();
        verify(registryService, never()).rebuild(any());
        verify(metrics).recordSyncFailure(any());
        verify(metrics, never()).recordSyncSuccess(any());
    }

    @Test
    void record_failure_metric_when_clone_all_leaves_clone_state_failed() {
        // cloneAll() never throws - per-repo git errors are folded into the clone state,
        // so an unreachable GitHub must not be recorded as a successful startup sync.
        GitHubStartupInitializer initializer = initializerFor(
                Optional.of(List.of("finos|finos/repo|main")), "github");
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of("finos", Path.of("/tmp/finos")));
        when(cloneManager.getState()).thenReturn(GitHubCloneManager.State.FAILED);

        initializer.onStart(new StartupEvent());

        verify(metrics).recordSyncFailure(any());
        verify(metrics, never()).recordSyncSuccess(any());
    }

    @Test
    void record_failure_metric_when_clone_all_leaves_clone_state_degraded() {
        GitHubStartupInitializer initializer = initializerFor(
                Optional.of(List.of("finos|finos/repo|main")), "github");
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of("finos", Path.of("/tmp/finos")));
        when(cloneManager.getState()).thenReturn(GitHubCloneManager.State.DEGRADED);

        initializer.onStart(new StartupEvent());

        verify(metrics).recordSyncFailure(any());
        verify(metrics, never()).recordSyncSuccess(any());
    }

    @Test
    void warn_at_startup_that_the_audit_trail_is_not_persisted_in_github_mode() {
        // GitHubAuditLogStore.query() always returns an empty list, so an operator must be
        // told at startup rather than discover the gap when they go looking for the trail.
        // Warned even with no namespaces configured: the gap exists regardless.
        List<String> warnings = captureWarnings(() ->
                initializerFor(Optional.empty(), "github").onStart(new StartupEvent()));

        assertThat(warnings, hasItem(containsString("audit trail is not persisted")));
    }

    @Test
    void not_warn_about_the_audit_trail_outside_github_mode() {
        List<String> warnings = captureWarnings(() ->
                initializerFor(Optional.empty(), "mongo").onStart(new StartupEvent()));

        assertThat(warnings, empty());
    }

    private static List<String> captureWarnings(Runnable action) {
        Logger logger = Logger.getLogger(GitHubStartupInitializer.class.getName());
        List<String> warnings = new ArrayList<>();
        Handler handler = new Handler() {
            @Override
            public void publish(LogRecord logRecord) {
                if (logRecord.getLevel().intValue() >= Level.WARNING.intValue()) {
                    warnings.add(logRecord.getMessage());
                }
            }

            @Override
            public void flush() {
            }

            @Override
            public void close() {
            }
        };
        logger.addHandler(handler);
        try {
            action.run();
        } finally {
            logger.removeHandler(handler);
        }
        return warnings;
    }

    @Test
    void parse_blank_access_groups_as_empty_set() {
        GitHubStartupInitializer initializer = initializerFor(Optional.of(List.of(
                "finos|finos/repo|main|  "
        )), "github");
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of(
                "finos", Path.of("/tmp/finos")
        ));

        initializer.onStart(new StartupEvent());

        verify(cloneManager).registerNamespace("finos", "finos/repo", "main", Set.of());
    }
}
