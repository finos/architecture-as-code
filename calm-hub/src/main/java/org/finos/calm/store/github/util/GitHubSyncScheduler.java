package org.finos.calm.store.github.util;

import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.observability.GitHubMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;

/**
 * Periodically pulls all registered namespace repos and rebuilds the in-memory registry.
 * Only active when calm.database.mode=github.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubSyncScheduler {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubSyncScheduler.class);

    private final GitHubCloneManager cloneManager;
    private final InMemoryRegistryService registryService;
    private final GitHubMetrics metrics;

    // @LookupIfProperty does not stop @Scheduled invocation once this bean exists - see
    // the identical guard and comment in GitHubStartupInitializer for why this is needed.
    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    public GitHubSyncScheduler(GitHubCloneManager cloneManager,
                               InMemoryRegistryService registryService,
                               GitHubMetrics metrics) {
        this.cloneManager = cloneManager;
        this.registryService = registryService;
        this.metrics = metrics;
    }

    // concurrentExecution = SKIP: without it, a pullAll() slower than the sync interval
    // overlaps the next tick and runs "reset --hard" on a clone directory a request
    // thread may be mid-Files.readString on.
    @Scheduled(every = "${calm.github.sync-interval:60}s", delayed = "${calm.github.sync-interval:60}s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void sync() {
        if (!DatabaseMode.GITHUB.equals(databaseMode) || !cloneManager.hasNamespaces()) {
            return;
        }

        Instant start = Instant.now();
        try {
            cloneManager.pullAll();

            Instant rebuildStart = Instant.now();
            registryService.rebuild(cloneManager.getNamespaceClonePaths());
            metrics.recordRegistryRebuild(Duration.between(rebuildStart, Instant.now()));

            Duration total = Duration.between(start, Instant.now());
            metrics.recordSyncSuccess(total);
            LOG.debug("Sync completed in {}ms", total.toMillis());
        } catch (Exception e) {
            Duration total = Duration.between(start, Instant.now());
            metrics.recordSyncFailure(total);
            LOG.error("Sync failed after {}ms: {}", total.toMillis(), e.getMessage());
        }
    }
}
