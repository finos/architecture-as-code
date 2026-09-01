package org.finos.calm.store.github.util;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages parallel cloning of all registered namespace repos on startup,
 * tracks clone state, and provides pull-all for periodic sync.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubCloneManager {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubCloneManager.class);

    public enum State { INITIALIZING, CLONING, READY, DEGRADED, FAILED }

    private volatile State state = State.INITIALIZING;
    private final Map<String, NamespaceRepo> namespaceRepos = new ConcurrentHashMap<>();

    private final GitHubRepoSync repoSync;
    private final GitHubStoreConfig config;

    @Inject
    public GitHubCloneManager(GitHubRepoSync repoSync, GitHubStoreConfig config) {
        this.repoSync = repoSync;
        this.config = config;
    }

    public State getState() {
        return state;
    }

    public void registerNamespace(String name, String repoFullName, String branch) {
        namespaceRepos.put(name, new NamespaceRepo(repoFullName, branch, Set.of()));
    }

    public void registerNamespace(String name, String repoFullName, String branch, Set<String> accessGroups) {
        namespaceRepos.put(name, new NamespaceRepo(repoFullName, branch, accessGroups));
    }

    public Set<String> getAccessGroupsForNamespace(String namespace) {
        NamespaceRepo repo = namespaceRepos.get(namespace);
        return repo != null ? repo.accessGroups() : Set.of();
    }

    public void cloneAll() {
        if (namespaceRepos.isEmpty()) {
            LOG.warn("No namespaces registered — nothing to clone");
            state = State.READY;
            return;
        }

        state = State.CLONING;
        int succeeded = 0;
        int failed = 0;

        for (Map.Entry<String, NamespaceRepo> entry : namespaceRepos.entrySet()) {
            String namespace = entry.getKey();
            NamespaceRepo repo = entry.getValue();
            Path targetDir = config.getCloneDirectory().resolve(namespace);

            boolean success;
            if (repoSync.isValidRepo(targetDir)) {
                success = repoSync.pullRepo(targetDir, config.getServiceToken());
            } else {
                success = repoSync.cloneRepo(repo.repoFullName(), repo.branch(), targetDir, config.getServiceToken());
            }

            if (success) {
                succeeded++;
            } else {
                failed++;
            }
        }

        if (failed == 0) {
            state = State.READY;
        } else if (succeeded > 0) {
            state = State.DEGRADED;
            LOG.warn("Clone completed in DEGRADED state: {} succeeded, {} failed", succeeded, failed);
        } else {
            state = State.FAILED;
            LOG.error("Clone FAILED: all {} repos failed", failed);
        }
    }

    public void pullAll() {
        if (state == State.CLONING || state == State.INITIALIZING) {
            LOG.debug("Skipping pullAll — state is {}", state);
            return;
        }

        int succeeded = 0;
        int failed = 0;

        for (Map.Entry<String, NamespaceRepo> entry : namespaceRepos.entrySet()) {
            String namespace = entry.getKey();
            Path targetDir = config.getCloneDirectory().resolve(namespace);

            if (repoSync.isValidRepo(targetDir)) {
                if (repoSync.pullRepo(targetDir, config.getServiceToken())) {
                    succeeded++;
                } else {
                    failed++;
                }
            } else {
                failed++;
            }
        }

        if (failed > 0 && succeeded == 0) {
            state = State.FAILED;
        } else if (failed > 0) {
            state = State.DEGRADED;
        } else {
            state = State.READY;
        }
    }

    public Map<String, Path> getNamespaceClonePaths() {
        Map<String, Path> paths = new HashMap<>();
        for (String namespace : namespaceRepos.keySet()) {
            paths.put(namespace, config.getCloneDirectory().resolve(namespace));
        }
        return paths;
    }

    public boolean hasNamespaces() {
        return !namespaceRepos.isEmpty();
    }

    public String getRepoForNamespace(String namespace) {
        NamespaceRepo repo = namespaceRepos.get(namespace);
        return repo != null ? repo.repoFullName() : null;
    }

    record NamespaceRepo(String repoFullName, String branch, Set<String> accessGroups) {}
}
