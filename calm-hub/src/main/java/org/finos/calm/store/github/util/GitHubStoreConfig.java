package org.finos.calm.store.github.util;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubStoreConfig {

    @Inject
    @ConfigProperty(name = "calm.github.service-token")
    Optional<String> serviceToken;

    @Inject
    @ConfigProperty(name = "calm.github.clone-directory", defaultValue = "/tmp/calm-hub-clones")
    String cloneDirectory;

    @Inject
    @ConfigProperty(name = "calm.github.sync-interval", defaultValue = "60")
    int syncInterval;

    @Inject
    @ConfigProperty(name = "calm.github.api-url", defaultValue = "https://api.github.com")
    String apiUrl;

    @Inject
    @ConfigProperty(name = "calm.github.namespaces")
    Optional<List<String>> namespaceConfigs;

    public String getServiceToken() {
        return serviceToken.orElse("");
    }

    public Path getCloneDirectory() {
        return Path.of(cloneDirectory);
    }

    public int getSyncInterval() {
        return syncInterval;
    }

    public String getApiUrl() {
        return apiUrl;
    }
}
