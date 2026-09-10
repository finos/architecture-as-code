package org.finos.calm.store.github.sync;

import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.context.ManagedExecutor;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.observability.GitHubMetrics;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Reads namespace configuration on startup, registers repos with the clone manager,
 * triggers initial clone asynchronously, and rebuilds the in-memory registry once complete.
 * Quarkus finishes starting immediately — there is no readiness endpoint gating this
 * (no {@code @Readiness}/smallrye-health dependency exists in this module); a request for
 * a validly-configured namespace that arrives before the initial clone completes sees
 * {@link org.finos.calm.domain.exception.NamespaceNotFoundException} (404) rather than a
 * "still starting up" response, since the registry starts empty. See
 * {@link GitHubCloneManager#getState()} for the actual in-progress signal callers can poll.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubStartupInitializer {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubStartupInitializer.class);

    private final GitHubCloneManager cloneManager;
    private final ResourceRegistry registryService;
    private final GitHubMetrics metrics;
    private final ManagedExecutor executor;
    private final Optional<List<String>> namespaceConfigs;
    // @LookupIfProperty only gates whether this bean satisfies @Inject/Instance<T>
    // resolution - it does NOT stop an @Observes StartupEvent method from firing once the
    // bean exists, so without this check onStart() runs in every calm.database.mode.
    // Mirrors the identical guard in StandaloneDemoSeeder for the same reason.
    private final String databaseMode;

    @Inject
    public GitHubStartupInitializer(GitHubCloneManager cloneManager,
                                     ResourceRegistry registryService,
                                     GitHubMetrics metrics,
                                     ManagedExecutor executor,
                                     @ConfigProperty(name = "calm.github.namespaces") Optional<List<String>> namespaceConfigs,
                                     @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo") String databaseMode) {
        this.cloneManager = cloneManager;
        this.registryService = registryService;
        this.metrics = metrics;
        this.executor = executor;
        this.namespaceConfigs = namespaceConfigs;
        this.databaseMode = databaseMode;
    }

    // Package-private, taking the CDI-mandated StartupEvent parameter: this is a
    // framework contract method, not a test seam - @Observes requires it callable by
    // the container with exactly this signature.
    void onStart(@Observes StartupEvent ev) {
        if (!DatabaseMode.GITHUB.equals(databaseMode)) {
            return;
        }

        List<String> configs = namespaceConfigs.orElse(List.of());
        if (configs.isEmpty()) {
            LOG.warn("No GitHub namespaces configured (calm.github.namespaces). The registry will be empty.");
            return;
        }

        for (String entry : configs) {
            String[] parts = entry.split("\\|");
            if (parts.length < 2) {
                LOG.warn("Invalid namespace config entry (expected 'name|repo|branch[|accessGroups]'): {}", entry);
                continue;
            }
            String name = parts[0].trim();
            String repo = parts[1].trim();
            String branch = parts.length > 2 ? parts[2].trim() : "main";
            Set<String> accessGroups = parts.length > 3 ? parseGroups(parts[3]) : Set.of();
            cloneManager.registerNamespace(name, repo, branch, accessGroups);
            LOG.info("Registered namespace [{}] → repo [{}] branch [{}] accessGroups={}",
                    name, repo, branch, accessGroups);
        }

        executor.runAsync(this::cloneAndRebuild);
        LOG.info("GitHub clone started asynchronously — state: {}", cloneManager.getState());
    }

    private Set<String> parseGroups(String groupsStr) {
        if (groupsStr == null || groupsStr.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(groupsStr.split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    void cloneAndRebuild() {
        try {
            Instant start = Instant.now();
            cloneManager.cloneAll();

            Instant rebuildStart = Instant.now();
            registryService.rebuild(cloneManager.getNamespaceClonePaths());
            metrics.recordRegistryRebuild(Duration.between(rebuildStart, Instant.now()));

            Duration total = Duration.between(start, Instant.now());
            metrics.recordSyncSuccess(total);
            LOG.info("GitHub clone complete in {}ms — state: {}", total.toMillis(), cloneManager.getState());
        } catch (Exception e) {
            LOG.error("GitHub clone failed: {}", e.getMessage(), e);
        }
    }
}
