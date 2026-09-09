package org.finos.calm.store.github.util;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.ConfigProvider;

import java.nio.file.Path;

/**
 * {@code calm.github.service-token}, {@code calm.github.clone-directory}, and
 * {@code calm.github.api-url} are all env-only (declared in no
 * {@code application*.properties} file) — exactly the kind of operator-supplied,
 * potentially-rotating value {@code @ConfigProperty} field injection gets wrong in a
 * native image, where the value is captured at build time and a runtime env var
 * override is silently ignored. Resolved once at runtime startup via
 * {@link #init()} instead, the same pattern used by {@code ReadOnlyRequestFilter} and
 * {@code AuditService} — see {@code calm-hub/AGENTS.md}'s native-image config guidance.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubStoreConfig {

    // Package-private so unit tests can set these directly rather than going through init().
    String serviceToken;
    String cloneDirectory;
    String apiUrl;

    @PostConstruct
    void init() {
        serviceToken = ConfigProvider.getConfig()
                .getOptionalValue("calm.github.service-token", String.class)
                .orElse("");
        cloneDirectory = ConfigProvider.getConfig()
                .getOptionalValue("calm.github.clone-directory", String.class)
                .orElse("/tmp/calm-hub-clones");
        apiUrl = ConfigProvider.getConfig()
                .getOptionalValue("calm.github.api-url", String.class)
                .orElse("https://api.github.com");
    }

    public String getServiceToken() {
        return serviceToken;
    }

    public Path getCloneDirectory() {
        return Path.of(cloneDirectory);
    }

    public String getApiUrl() {
        return apiUrl;
    }
}
