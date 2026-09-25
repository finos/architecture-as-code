package org.finos.calm.store.github.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

class TestGitHubStoreConfigShould {

    @Test
    void return_service_token_when_present() {
        GitHubStoreConfig config = new GitHubStoreConfig("ghp_test123", "/tmp/calm-hub-clones", "https://api.github.com");
        assertThat(config.getServiceToken(), equalTo("ghp_test123"));
    }

    @Test
    void return_empty_string_when_service_token_absent() {
        GitHubStoreConfig config = new GitHubStoreConfig("", "/tmp/calm-hub-clones", "https://api.github.com");
        assertThat(config.getServiceToken(), equalTo(""));
    }

    @Test
    void return_clone_directory_as_path() {
        GitHubStoreConfig config = new GitHubStoreConfig("", "/tmp/calm-clones", "https://api.github.com");
        assertThat(config.getCloneDirectory(), equalTo(Path.of("/tmp/calm-clones")));
    }

    @Test
    void return_api_url() {
        GitHubStoreConfig config = new GitHubStoreConfig("", "/tmp/calm-hub-clones", "https://api.github.com");
        assertThat(config.getApiUrl(), equalTo("https://api.github.com"));
    }

    @Test
    void resolve_defaults_from_config_when_nothing_set() {
        org.eclipse.microprofile.config.Config config = org.mockito.Mockito.mock(org.eclipse.microprofile.config.Config.class);
        org.mockito.Mockito.when(config.getOptionalValue("calm.github.service-token", String.class))
                .thenReturn(java.util.Optional.empty());
        org.mockito.Mockito.when(config.getOptionalValue("calm.github.clone-directory", String.class))
                .thenReturn(java.util.Optional.empty());
        org.mockito.Mockito.when(config.getOptionalValue("calm.github.api-url", String.class))
                .thenReturn(java.util.Optional.empty());

        GitHubStoreConfig storeConfig = new GitHubStoreConfig(config);

        assertThat(storeConfig.getServiceToken(), equalTo(""));
        assertThat(storeConfig.getCloneDirectory(), equalTo(Path.of("/tmp/calm-hub-clones")));
        assertThat(storeConfig.getApiUrl(), equalTo("https://api.github.com"));
    }

    @Test
    void resolve_configured_values_from_config() {
        org.eclipse.microprofile.config.Config config = org.mockito.Mockito.mock(org.eclipse.microprofile.config.Config.class);
        org.mockito.Mockito.when(config.getOptionalValue("calm.github.service-token", String.class))
                .thenReturn(java.util.Optional.of("ghp_configured"));
        org.mockito.Mockito.when(config.getOptionalValue("calm.github.clone-directory", String.class))
                .thenReturn(java.util.Optional.of("/data/clones"));
        org.mockito.Mockito.when(config.getOptionalValue("calm.github.api-url", String.class))
                .thenReturn(java.util.Optional.of("https://github.example.com/api/v3"));

        GitHubStoreConfig storeConfig = new GitHubStoreConfig(config);

        assertThat(storeConfig.getServiceToken(), equalTo("ghp_configured"));
        assertThat(storeConfig.getCloneDirectory(), equalTo(Path.of("/data/clones")));
        assertThat(storeConfig.getApiUrl(), equalTo("https://github.example.com/api/v3"));
    }
}
