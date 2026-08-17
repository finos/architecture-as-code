package org.finos.calm.store.github.util;

import io.quarkus.runtime.StartupEvent;
import org.finos.calm.observability.GitHubMetrics;
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
    private InMemoryRegistryService registryService;

    @Mock
    private GitHubMetrics metrics;

    private GitHubStartupInitializer initializer;

    @BeforeEach
    void setup() {
        initializer = new GitHubStartupInitializer();
        initializer.cloneManager = cloneManager;
        initializer.registryService = registryService;
        initializer.metrics = metrics;
    }

    @Test
    void skip_when_no_namespaces_configured() {
        initializer.namespaceConfigs = Optional.empty();

        initializer.onStart(new StartupEvent());

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

        verify(cloneManager).registerNamespace("finos", "finos/architecture-as-code", "main");
        verify(cloneManager).registerNamespace("team", "my-org/team-repo", "main");
        verify(cloneManager).cloneAll();
        verify(registryService).rebuild(any());
        verify(metrics).recordSyncSuccess(any());
    }

    @Test
    void skip_invalid_entries() {
        initializer.namespaceConfigs = Optional.of(List.of("invalid-no-pipe"));
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of());

        initializer.onStart(new StartupEvent());

        verify(cloneManager, never()).registerNamespace(any(), any(), any());
    }
}
