package org.finos.calm.store.github.util;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

class TestGitHubStoreConfigShould {

    @Test
    void return_service_token_when_present() {
        GitHubStoreConfig config = new GitHubStoreConfig();
        config.serviceToken = Optional.of("ghp_test123");
        assertThat(config.getServiceToken(), equalTo("ghp_test123"));
    }

    @Test
    void return_empty_string_when_service_token_absent() {
        GitHubStoreConfig config = new GitHubStoreConfig();
        config.serviceToken = Optional.empty();
        assertThat(config.getServiceToken(), equalTo(""));
    }

    @Test
    void return_clone_directory_as_path() {
        GitHubStoreConfig config = new GitHubStoreConfig();
        config.cloneDirectory = "/tmp/calm-clones";
        assertThat(config.getCloneDirectory(), equalTo(Path.of("/tmp/calm-clones")));
    }

    @Test
    void return_sync_interval() {
        GitHubStoreConfig config = new GitHubStoreConfig();
        config.syncInterval = 120;
        assertThat(config.getSyncInterval(), equalTo(120));
    }

    @Test
    void return_api_url() {
        GitHubStoreConfig config = new GitHubStoreConfig();
        config.apiUrl = "https://api.github.com";
        assertThat(config.getApiUrl(), equalTo("https://api.github.com"));
    }
}
