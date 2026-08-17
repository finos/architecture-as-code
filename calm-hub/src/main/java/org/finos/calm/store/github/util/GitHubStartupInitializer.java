package org.finos.calm.store.github.util;

import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.observability.GitHubMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Reads namespace configuration on startup, registers repos with the clone manager,
 * triggers initial clone, and rebuilds the in-memory registry.
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
                LOG.warn("Invalid namespace config entry (expected 'name|repo|branch'): {}", entry);
                continue;
            }
            String name = parts[0].trim();
            String repo = parts[1].trim();
            String branch = parts.length > 2 ? parts[2].trim() : "main";
            cloneManager.registerNamespace(name, repo, branch);
            LOG.info("Registered namespace [{}] → repo [{}] branch [{}]", name, repo, branch);
        }

        Instant start = Instant.now();
        cloneManager.cloneAll();

        Instant rebuildStart = Instant.now();
        registryService.rebuild(cloneManager.getNamespaceClonePaths());
        metrics.recordRegistryRebuild(Duration.between(rebuildStart, Instant.now()));

        Duration total = Duration.between(start, Instant.now());
        metrics.recordSyncSuccess(total);
        LOG.info("GitHub startup complete in {}ms — state: {}", total.toMillis(), cloneManager.getState());
    }
}
