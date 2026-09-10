package org.finos.calm.store.github.util;

import io.quarkus.runtime.StartupEvent;
import org.eclipse.microprofile.context.ManagedExecutor;
import org.finos.calm.observability.GitHubMetrics;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
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

    private GitHubStartupInitializer initializer;

    @BeforeEach
    void setup() {
        initializer = new GitHubStartupInitializer();
        initializer.cloneManager = cloneManager;
        initializer.registryService = registryService;
        initializer.metrics = metrics;
        initializer.executor = executor;
        initializer.databaseMode = "github";

        // Make executor.runAsync execute the Runnable immediately (synchronously for testing)
        when(executor.runAsync(any(Runnable.class))).thenAnswer(invocation -> {
            Runnable task = invocation.getArgument(0);
            task.run();
            return CompletableFuture.completedFuture(null);
        });
    }

    @Test
    void skip_when_no_namespaces_configured() {
        initializer.namespaceConfigs = Optional.empty();

        initializer.onStart(new StartupEvent());

        verify(cloneManager, never()).cloneAll();
        verify(registryService, never()).rebuild(any());
    }

    @Test
    void skip_entirely_when_database_mode_is_not_github() {
        // @LookupIfProperty only gates @Inject/Instance<T> resolution, not @Observes
        // invocation once the bean exists - this guard is what actually stops onStart()
        // from registering namespaces and cloning in, say, mongo mode.
        initializer.databaseMode = "mongo";
        initializer.namespaceConfigs = Optional.of(List.of("finos|finos/architecture-as-code|main"));

        initializer.onStart(new StartupEvent());

        verify(cloneManager, never()).registerNamespace(any(), any(), any(), any());
        verify(cloneManager, never()).cloneAll();
        verify(registryService, never()).rebuild(any());
    }

    @Test
    void register_namespaces_and_clone() {
        initializer.namespaceConfigs = Optional.of(List.of(
                "finos|finos/architecture-as-code|main",
                "team|my-org/team-repo"
        ));
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of(
                "finos", Path.of("/tmp/finos"),
                "team", Path.of("/tmp/team")
        ));

        initializer.onStart(new StartupEvent());

        verify(cloneManager).registerNamespace("finos", "finos/architecture-as-code", "main", java.util.Set.of());
        verify(cloneManager).registerNamespace("team", "my-org/team-repo", "main", java.util.Set.of());
        verify(cloneManager).cloneAll();
        verify(registryService).rebuild(any());
        verify(metrics).recordSyncSuccess(any());
    }

    @Test
    void skip_invalid_entries() {
        initializer.namespaceConfigs = Optional.of(List.of("invalid-no-pipe"));
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of());

        initializer.onStart(new StartupEvent());

        verify(cloneManager, never()).registerNamespace(any(), any(), any(), any());
    }

    @Test
    void parse_access_groups_from_namespace_config() {
        initializer.namespaceConfigs = Optional.of(List.of(
                "finos|finos/repo|main|group-a;group-b"
        ));
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of(
                "finos", Path.of("/tmp/finos")
        ));

        initializer.onStart(new StartupEvent());

        verify(cloneManager).registerNamespace("finos", "finos/repo", "main",
                java.util.Set.of("group-a", "group-b"));
    }

    @Test
    void handle_clone_failure_gracefully() {
        initializer.namespaceConfigs = Optional.of(List.of("finos|finos/repo|main"));
        when(executor.runAsync(any(Runnable.class))).thenAnswer(invocation -> {
            Runnable task = invocation.getArgument(0);
            task.run();
            return java.util.concurrent.CompletableFuture.completedFuture(null);
        });
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of());
        org.mockito.Mockito.doThrow(new RuntimeException("clone failed")).when(cloneManager).cloneAll();

        initializer.onStart(new StartupEvent());

        verify(cloneManager).cloneAll();
        verify(registryService, never()).rebuild(any());
    }

    @Test
    void parse_blank_access_groups_as_empty_set() {
        initializer.namespaceConfigs = Optional.of(List.of(
                "finos|finos/repo|main|  "
        ));
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of(
                "finos", Path.of("/tmp/finos")
        ));

        initializer.onStart(new StartupEvent());

        verify(cloneManager).registerNamespace("finos", "finos/repo", "main", java.util.Set.of());
    }
}
