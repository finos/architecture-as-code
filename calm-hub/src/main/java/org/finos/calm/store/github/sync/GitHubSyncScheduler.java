package org.finos.calm.store.github.sync;

import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.observability.GitHubMetrics;
import org.finos.calm.store.github.registry.ResourceRegistry;
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
    private final ResourceRegistry registryService;
    private final GitHubMetrics metrics;
    // @LookupIfProperty does not stop @Scheduled invocation once this bean exists - see
    // the identical guard and comment in GitHubStartupInitializer for why this is needed.
    private final String databaseMode;

    @Inject
    public GitHubSyncScheduler(GitHubCloneManager cloneManager,
                                ResourceRegistry registryService,
                                GitHubMetrics metrics,
                                @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo") String databaseMode) {
        this.cloneManager = cloneManager;
        this.registryService = registryService;
        this.metrics = metrics;
        this.databaseMode = databaseMode;
    }

    // concurrentExecution = SKIP prevents this method from overlapping its own next
    // scheduled tick - it does NOT protect a request thread mid-Files.readString on a
    // clone directory from a concurrent "reset --hard" here, and it does NOT prevent
    // overlap with GitHubStartupInitializer's own registry rebuild during the initial
    // clone window. Both remain open races - see the tracking issue for GitHub clone
    // lifecycle coordination with concurrent readers.
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
            // pullAll() never throws - every per-repo git failure is caught inside
            // GitHubRepoSync and folded into cloneManager's state instead. Recording
            // success purely on "no exception" would mean an unreachable GitHub, or an
            // expired token, reports as a healthy sync for every namespace, forever -
            // check the outcome pullAll() actually left behind.
            GitHubCloneManager.State stateAfterSync = cloneManager.getState();
            if (stateAfterSync == GitHubCloneManager.State.FAILED
                    || stateAfterSync == GitHubCloneManager.State.DEGRADED) {
                metrics.recordSyncFailure(total);
                LOG.error("Sync completed in {}ms but left clone state {} - at least one namespace failed to pull",
                        total.toMillis(), stateAfterSync);
            } else {
                metrics.recordSyncSuccess(total);
                LOG.debug("Sync completed in {}ms", total.toMillis());
            }
        } catch (Exception e) {
            Duration total = Duration.between(start, Instant.now());
            metrics.recordSyncFailure(total);
            LOG.error("Sync failed after {}ms: {}", total.toMillis(), e.getMessage());
        }
    }
}
