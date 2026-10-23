package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.Startup;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.ExtensionsConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Loads the extension manifests at startup. A bad manifest stops startup, so that an operator
 * sees the problem at deploy time and not when a user opens the page.
 */
@Startup
@ApplicationScoped
public class ExtensionRegistry {

    static final int SUPPORTED_HUB_API = 0;
    static final Set<String> SCOPES = Set.of("authenticated", "global_admin");
    private static final Pattern ID = Pattern.compile("^[a-z0-9][a-z0-9-]{0,62}$");
    private static final Logger LOG = LoggerFactory.getLogger(ExtensionRegistry.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ExtensionsConfig config;
    private final boolean authEnabled;
    private Map<String, ExtensionManifest> manifests = Map.of();

    @Inject
    public ExtensionRegistry(ExtensionsConfig config,
                             @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false") boolean authEnabled) {
        this.config = config;
        this.authEnabled = authEnabled;
    }

    @PostConstruct
    void load() {
        Optional<String> dir = config.dir();
        if (dir.isEmpty() || dir.get().isBlank()) {
            return;
        }
        List<ExtensionManifest> loaded = new ArrayList<>();
        try (Stream<Path> folders = Files.list(Path.of(dir.get()))) {
            for (Path folder : folders.filter(Files::isDirectory).sorted().toList()) {
                Path file = folder.resolve("extension.json");
                if (Files.isRegularFile(file)) {
                    loaded.add(validate(MAPPER.readValue(file.toFile(), ExtensionManifest.class), file));
                }
            }
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read extensions from " + dir.get(), e);
        }
        manifests = loaded.stream()
                .sorted(Comparator.comparing(ExtensionManifest::id))
                .collect(Collectors.toMap(ExtensionManifest::id, Function.identity(), (a, b) -> {
                    throw new IllegalStateException("Duplicate extension id " + a.id());
                }, LinkedHashMap::new));

        if (!manifests.isEmpty() && config.identity().privateKeyLocation().isEmpty()) {
            throw new IllegalStateException("calm.extensions.identity.private-key-location must be set when extensions are enabled");
        }
        if (!manifests.isEmpty() && !authEnabled) {
            LOG.warn("Authentication is off, so every caller can use every route of the {} enabled extension(s)", manifests.size());
        }
        LOG.info("Loaded extensions: {}", manifests.keySet());
    }

    public List<ExtensionManifest> all() {
        return List.copyOf(manifests.values());
    }

    public Optional<ExtensionManifest> find(String id) {
        return Optional.ofNullable(manifests.get(id));
    }

    static ExtensionManifest validate(ExtensionManifest m, Path source) {
        List<String> problems = new ArrayList<>();
        if (m.id() == null || !ID.matcher(m.id()).matches()) {
            problems.add("id must match " + ID.pattern());
        } else if (!m.id().equals(source.getParent().getFileName().toString())) {
            problems.add("id must equal the folder name");
        }
        if (m.hubApi() == null || m.hubApi() != SUPPORTED_HUB_API) {
            problems.add("hubApi must be " + SUPPORTED_HUB_API);
        }
        if (m.name() == null || m.name().isBlank()) {
            problems.add("name is required");
        }
        if (m.backend() == null || !isHttpUrl(m.backend().url())) {
            problems.add("backend.url must be an absolute http or https URL");
        }
        if (m.routes() != null) {
            for (ExtensionManifest.Route r : m.routes()) {
                if (r.path() == null || !r.path().startsWith("/")) {
                    problems.add("route path must start with /");
                }
                if (r.scope() == null || !SCOPES.contains(r.scope())) {
                    problems.add("route scope must be one of " + SCOPES);
                }
            }
        }
        if (m.contributes() != null && m.contributes().screen() != null && m.screenRoute() == null) {
            problems.add("contributes.screen.route must name a GET route");
        }
        if (!problems.isEmpty()) {
            throw new IllegalStateException("Invalid extension manifest " + source + ": " + String.join("; ", problems));
        }
        return m;
    }

    private static boolean isHttpUrl(String url) {
        if (url == null) {
            return false;
        }
        try {
            URI uri = URI.create(url);
            return uri.isAbsolute() && ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) && uri.getHost() != null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
