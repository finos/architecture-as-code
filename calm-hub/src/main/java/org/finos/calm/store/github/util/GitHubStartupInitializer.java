package org.finos.calm.store.github.util;

import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.context.ManagedExecutor;
import org.finos.calm.observability.GitHubMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Reads namespace configuration on startup, registers repos with the clone manager,
 * triggers initial clone asynchronously, and rebuilds the in-memory registry once complete.
 * Quarkus finishes starting immediately — health endpoints are available during clone.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubStartupInitializer {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubStartupInitializer.class);

    @Inject
    GitHubCloneManager cloneManager;

    @Inject
    InMemoryRegistryService registryService;

    @Inject
    GitHubMetrics metrics;

    @Inject
    ManagedExecutor executor;

    @Inject
    @ConfigProperty(name = "calm.github.namespaces")
    Optional<List<String>> namespaceConfigs;

    void onStart(@Observes StartupEvent ev) {
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
            java.util.Set<String> accessGroups = parts.length > 3 ? parseGroups(parts[3]) : java.util.Set.of();
            cloneManager.registerNamespace(name, repo, branch, accessGroups);
            LOG.info("Registered namespace [{}] → repo [{}] branch [{}] accessGroups={}",
                    name, repo, branch, accessGroups);
        }

        executor.runAsync(this::cloneAndRebuild);
        LOG.info("GitHub clone started asynchronously — state: {}", cloneManager.getState());
    }

    private java.util.Set<String> parseGroups(String groupsStr) {
        if (groupsStr == null || groupsStr.isBlank()) {
            return java.util.Set.of();
        }
        return java.util.Arrays.stream(groupsStr.split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(java.util.stream.Collectors.toSet());
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
