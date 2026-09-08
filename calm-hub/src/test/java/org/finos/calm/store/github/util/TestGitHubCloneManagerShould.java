package org.finos.calm.store.github.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestGitHubCloneManagerShould {

    @Mock
    private GitHubRepoSync repoSync;

    @Mock
    private GitHubStoreConfig config;

    private GitHubCloneManager cloneManager;

    @BeforeEach
    void setup() {
        when(config.getCloneDirectory()).thenReturn(Path.of("/tmp/test-clones"));
        when(config.getServiceToken()).thenReturn("test-token");
        cloneManager = new GitHubCloneManager(repoSync, config);
    }

    @Test
    void start_in_initializing_state() {
        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.INITIALIZING));
    }

    @Test
    void transition_to_ready_when_no_namespaces_registered() {
        cloneManager.cloneAll();
        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.READY));
    }

    @Test
    void transition_to_ready_when_all_clones_succeed() {
        cloneManager.registerNamespace("finos", "finos/architecture-as-code", "main");
        when(repoSync.isValidRepo(any())).thenReturn(false);
        when(repoSync.cloneRepo(eq("finos/architecture-as-code"), eq("main"), any(), eq("test-token")))
                .thenReturn(true);

        cloneManager.cloneAll();

        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.READY));
    }

    @Test
    void transition_to_failed_when_all_clones_fail() {
        cloneManager.registerNamespace("finos", "finos/architecture-as-code", "main");
        when(repoSync.isValidRepo(any())).thenReturn(false);
        when(repoSync.cloneRepo(any(), any(), any(), any())).thenReturn(false);

        cloneManager.cloneAll();

        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.FAILED));
    }

    @Test
    void transition_to_degraded_when_some_clones_fail() {
        cloneManager.registerNamespace("ns1", "org/repo1", "main");
        cloneManager.registerNamespace("ns2", "org/repo2", "main");
        when(repoSync.isValidRepo(any())).thenReturn(false);
        when(repoSync.cloneRepo(eq("org/repo1"), eq("main"), any(), any())).thenReturn(true);
        when(repoSync.cloneRepo(eq("org/repo2"), eq("main"), any(), any())).thenReturn(false);

        cloneManager.cloneAll();

        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.DEGRADED));
    }

    @Test
    void pull_instead_of_clone_when_repo_already_exists() {
        cloneManager.registerNamespace("finos", "finos/architecture-as-code", "main");
        when(repoSync.isValidRepo(any())).thenReturn(true);
        when(repoSync.pullRepo(any(), eq("test-token"))).thenReturn(true);

        cloneManager.cloneAll();

        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.READY));
    }

    @Test
    void skip_pull_all_when_still_cloning() {
        cloneManager.registerNamespace("finos", "finos/repo", "main");
        // State is INITIALIZING, pullAll should be a no-op
        cloneManager.pullAll();
        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.INITIALIZING));
    }

    @Test
    void pull_all_repos_and_stay_ready() {
        cloneManager.registerNamespace("finos", "finos/repo", "main");
        when(repoSync.isValidRepo(any())).thenReturn(false);
        when(repoSync.cloneRepo(any(), any(), any(), any())).thenReturn(true);
        cloneManager.cloneAll();

        when(repoSync.isValidRepo(any())).thenReturn(true);
        when(repoSync.pullRepo(any(), any())).thenReturn(true);
        cloneManager.pullAll();

        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.READY));
    }

    @Test
    void transition_to_failed_on_pull_all_when_all_fail() {
        cloneManager.registerNamespace("ns1", "org/repo1", "main");
        when(repoSync.isValidRepo(any())).thenReturn(false);
        when(repoSync.cloneRepo(any(), any(), any(), any())).thenReturn(true);
        cloneManager.cloneAll();

        when(repoSync.isValidRepo(any())).thenReturn(false);
        cloneManager.pullAll();

        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.FAILED));
    }

    @Test
    void return_namespace_clone_paths() {
        cloneManager.registerNamespace("finos", "finos/repo", "main");
        cloneManager.registerNamespace("team", "org/team-repo", "main");

        Map<String, Path> paths = cloneManager.getNamespaceClonePaths();

        assertThat(paths, hasKey("finos"));
        assertThat(paths, hasKey("team"));
        assertThat(paths.get("finos"), equalTo(Path.of("/tmp/test-clones/finos")));
    }

    @Test
    void report_has_namespaces_correctly() {
        assertThat(cloneManager.hasNamespaces(), is(false));
        cloneManager.registerNamespace("finos", "finos/repo", "main");
        assertThat(cloneManager.hasNamespaces(), is(true));
    }

    @Test
    void register_namespace_with_access_groups() {
        cloneManager.registerNamespace("finos", "finos/repo", "main", Set.of("group-a", "group-b"));
        assertThat(cloneManager.getAccessGroupsForNamespace("finos"), equalTo(Set.of("group-a", "group-b")));
    }

    @Test
    void return_empty_access_groups_for_unknown_namespace() {
        assertThat(cloneManager.getAccessGroupsForNamespace("unknown"), is(empty()));
    }

    @Test
    void return_repo_for_registered_namespace() {
        cloneManager.registerNamespace("finos", "finos/repo", "main");
        assertThat(cloneManager.getRepoForNamespace("finos"), equalTo("finos/repo"));
    }

    @Test
    void return_null_for_unknown_namespace_repo() {
        assertThat(cloneManager.getRepoForNamespace("unknown"), is(nullValue()));
    }

    @Test
    void transition_to_degraded_on_pull_all_when_some_fail() {
        cloneManager.registerNamespace("ns1", "org/repo1", "main");
        cloneManager.registerNamespace("ns2", "org/repo2", "main");
        when(repoSync.isValidRepo(any())).thenReturn(false);
        when(repoSync.cloneRepo(any(), any(), any(), any())).thenReturn(true);
        cloneManager.cloneAll();

        when(repoSync.isValidRepo(Path.of("/tmp/test-clones/ns1"))).thenReturn(true);
        when(repoSync.isValidRepo(Path.of("/tmp/test-clones/ns2"))).thenReturn(true);
        when(repoSync.pullRepo(Path.of("/tmp/test-clones/ns1"), "test-token")).thenReturn(true);
        when(repoSync.pullRepo(Path.of("/tmp/test-clones/ns2"), "test-token")).thenReturn(false);
        cloneManager.pullAll();

        assertThat(cloneManager.getState(), equalTo(GitHubCloneManager.State.DEGRADED));
    }
}
