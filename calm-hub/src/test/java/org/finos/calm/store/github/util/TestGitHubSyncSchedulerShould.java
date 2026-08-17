package org.finos.calm.store.github.util;

import org.finos.calm.observability.GitHubMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubSyncSchedulerShould {

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private InMemoryRegistryService registryService;

    @Mock
    private GitHubMetrics metrics;

    private GitHubSyncScheduler scheduler;

    @BeforeEach
    void setup() {
        scheduler = new GitHubSyncScheduler(cloneManager, registryService, metrics);
    }

    @Test
    void skip_sync_when_no_namespaces_registered() {
        when(cloneManager.hasNamespaces()).thenReturn(false);

        scheduler.sync();

        verify(cloneManager, never()).pullAll();
        verify(registryService, never()).rebuild(any());
    }

    @Test
    void pull_all_and_rebuild_registry_on_sync() {
        when(cloneManager.hasNamespaces()).thenReturn(true);
        when(cloneManager.getNamespaceClonePaths()).thenReturn(Map.of("finos", Path.of("/tmp/finos")));

        scheduler.sync();

        verify(cloneManager).pullAll();
        verify(registryService).rebuild(Map.of("finos", Path.of("/tmp/finos")));
        verify(metrics).recordSyncSuccess(any());
        verify(metrics).recordRegistryRebuild(any());
    }

    @Test
    void record_failure_metric_when_sync_throws() {
        when(cloneManager.hasNamespaces()).thenReturn(true);
        doThrow(new RuntimeException("sync error")).when(cloneManager).pullAll();

        scheduler.sync();

        verify(metrics).recordSyncFailure(any());
    }
}
