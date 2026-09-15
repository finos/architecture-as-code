package org.finos.calm.store.github.config;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.Config;

import java.nio.file.Path;

/**
 * {@code calm.github.service-token}, {@code calm.github.clone-directory}, and
 * {@code calm.github.api-url} are all env-only (declared in no
 * {@code application*.properties} file) — exactly the kind of operator-supplied,
 * potentially-rotating value {@code @ConfigProperty} field injection gets wrong in a
 * native image, where the value is captured at build time and a runtime env var
 * override is silently ignored. Resolved once, in the constructor, via an injected
 * {@link Config} instead — the same pattern used by {@code ReadOnlyRequestFilter} and
 * {@code AuditService} — see {@code calm-hub/AGENTS.md}'s native-image config guidance.
 *
 * <p>A second, plain constructor takes the three resolved values directly. It exists so
 * tests can build this class through its public API rather than reaching into
 * package-private fields — the {@code Config} lookup is the only part of this class
 * that needs a running container; the values themselves are inert once resolved.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubStoreConfig {

    private final String serviceToken;
    private final String cloneDirectory;
    private final String apiUrl;

    @Inject
    public GitHubStoreConfig(Config config) {
        this(
                config.getOptionalValue("calm.github.service-token", String.class).orElse(""),
                config.getOptionalValue("calm.github.clone-directory", String.class).orElse("/tmp/calm-hub-clones"),
                config.getOptionalValue("calm.github.api-url", String.class).orElse("https://api.github.com")
        );
    }

    public GitHubStoreConfig(String serviceToken, String cloneDirectory, String apiUrl) {
        this.serviceToken = serviceToken;
        this.cloneDirectory = cloneDirectory;
        this.apiUrl = apiUrl;
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
