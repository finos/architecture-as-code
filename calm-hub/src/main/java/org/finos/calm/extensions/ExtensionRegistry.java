package org.finos.calm.extensions;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.Config;
import org.finos.calm.config.ExtensionsConfig;
import org.finos.calm.domain.extensions.ChatProvider;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Loads the extension manifests and their operator settings at start up (ADR 0012). A bad manifest
 * or setting stops Hub, so that the operator sees it at deploy time. With no
 * {@code calm.extensions.dir} and no built-in manifests, there are no extensions.
 */
@ApplicationScoped
public class ExtensionRegistry {

    private static final Logger LOG = LoggerFactory.getLogger(ExtensionRegistry.class);
    private static final List<String> PER_ID_KEYS = List.of("enabled", "order", "backend-url", "allow-http", "send-identity",
            "connect-timeout-seconds", "request-timeout-seconds", "max-request-bytes", "max-response-bytes",
            "max-concurrent-calls", "max-concurrent-streams", "stream-idle-timeout-seconds", "max-stream-seconds");
    private static final Pattern PER_ID_SETTING = Pattern.compile(
            "^calm\\.extensions\\.(?:\"([a-z][a-z0-9-]*)\"|([a-z][a-z0-9-]*))\\.(?:" + String.join("|", PER_ID_KEYS) + ")$");
    /** The same settings as environment variables, such as {@code CALM_EXTENSIONS__TEAM_SERVICES__ENABLED}. */
    private static final Pattern PER_ID_ENV_SETTING = Pattern.compile(
            "^CALM_EXTENSIONS_(?:_([A-Z][A-Z0-9_]*?)__|([A-Z][A-Z0-9_]*?)_)(?:"
                    + String.join("|", PER_ID_KEYS.stream().map(k -> k.replace('-', '_').toUpperCase(Locale.ROOT)).toList())
                    + ")$");
    private static final Set<String> URL_SCHEMES = Set.of("http", "https");

    private final ExtensionsConfig config;
    private final Config properties;
    private final ClassLoader classLoader;
    private final String builtinBase;
    private volatile List<RegisteredExtension> extensions = List.of();
    private volatile ChatProvider chatProvider;
    private volatile boolean readOnly;

    @Inject
    public ExtensionRegistry(ExtensionsConfig config, Config properties) {
        this(config, properties, ExtensionRegistry.class.getClassLoader(), ExtensionManifestLoader.BUILTIN_BASE);
    }

    ExtensionRegistry(ExtensionsConfig config, Config properties, ClassLoader classLoader, String builtinBase) {
        this.config = config;
        this.properties = properties;
        this.classLoader = classLoader;
        this.builtinBase = builtinBase;
    }

    void onStartup(@Observes StartupEvent event) {
        load();
    }

    void load() {
        // Read at run time, as ReadOnlyRequestFilter does, so that a native image sees CALM_READONLY.
        readOnly = properties.getOptionalValue("calm.readonly", Boolean.class).orElse(false);
        ExtensionManifestLoader loader = new ExtensionManifestLoader();
        List<ExtensionManifest> manifests = new ArrayList<>(loader.loadClasspath(classLoader, builtinBase));
        config.dir().filter(dir -> !dir.isBlank())
                .ifPresent(dir -> manifests.addAll(loader.loadDirectory(Path.of(dir))));

        List<String> errors = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        Map<String, String> viewOwners = new HashMap<>();
        Map<String, String> lensOwners = new HashMap<>();
        List<RegisteredExtension> enabled = new ArrayList<>();
        for (ExtensionManifest manifest : manifests) {
            String id = manifest.id();
            if (!ids.add(id)) {
                errors.add("extension id '" + id + "' is declared by more than one manifest");
                continue;
            }
            Optional<Boolean> isEnabled = booleanSetting(id, "enabled", errors);
            Optional<Integer> order = intSetting(id, "order", errors);
            Optional<URI> backendUrl = urlSetting(id, "backend-url", errors);
            boolean allowHttp = booleanSetting(id, "allow-http", errors).orElse(false);
            boolean sendIdentity = booleanSetting(id, "send-identity", errors).orElse(true);
            ExtensionLimits limits = limits(id, errors);
            if (!isEnabled.orElse(true)) {
                LOG.info("Extension {} is disabled", id);
                continue;
            }
            // The UI finds some views by id alone, such as the built-in control-evaluation view.
            List<ExtensionManifest.DecoratorView> views = manifest.contributes().decoratorViews();
            for (ExtensionManifest.DecoratorView view : views == null ? List.<ExtensionManifest.DecoratorView>of() : views) {
                String owner = viewOwners.putIfAbsent(view.id(), id);
                if (owner != null) {
                    errors.add("decorator view id '" + view.id() + "' is declared by extensions '" + owner + "' and '"
                            + id + "'");
                }
            }
            // The URL names a lens by its id alone: ?lens=<id>.
            List<ExtensionManifest.DiagramLens> lenses = manifest.contributes().diagramLens();
            for (ExtensionManifest.DiagramLens lens : lenses == null ? List.<ExtensionManifest.DiagramLens>of() : lenses) {
                String owner = lensOwners.putIfAbsent(lens.id(), id);
                if (owner != null) {
                    errors.add("diagram lens id '" + lens.id() + "' is declared by extensions '" + owner + "' and '" + id + "'");
                }
            }
            if (!manifest.routes().isEmpty() && backendUrl.isEmpty()) {
                errors.add(key(id, "backend-url") + " must be set, because extension '" + id + "' is enabled and has routes");
            }
            backendUrl.filter(url -> "http".equalsIgnoreCase(url.getScheme()) && !allowHttp && !isLoopback(url.getHost()))
                    .ifPresent(url -> errors.add(key(id, "backend-url") + " must use https. Plain http is allowed only "
                            + "for a loopback host, or with " + key(id, "allow-http") + "=true"));
            // A service that changes data must know who asked, and the audit entry names the assertion that Hub sent.
            if (!sendIdentity && manifest.routes().stream().anyMatch(r -> !"GET".equals(r.method()) && !r.readOnly())) {
                errors.add(key(id, "send-identity") + "=false is allowed only when every route of extension '" + id
                        + "' is a GET or readOnly route");
            }
            enabled.add(new RegisteredExtension(manifest, order.orElse(0), backendUrl, limits, sendIdentity));
        }
        // With auth off every caller is a global admin, so every route would be open (ADR 0011).
        boolean authEnabled = properties.getOptionalValue("calm.auth.enabled", Boolean.class).orElse(false);
        if (!authEnabled && !config.allowWithoutAuth() && enabled.stream().anyMatch(e -> !e.manifest().routes().isEmpty())) {
            errors.add("an enabled extension has routes, but calm.auth.enabled is false. Every caller would be a global "
                    + "admin. Turn auth on, or set calm.extensions.allow-without-auth=true for local development");
        }
        ChatProvider chat = chatProvider(enabled, errors);
        warnAboutUnknownIds(ids);
        if (!errors.isEmpty()) {
            throw new IllegalStateException("Invalid calm.extensions configuration: " + String.join("; ", errors));
        }
        enabled.sort(Comparator.comparingInt(RegisteredExtension::order).thenComparing(RegisteredExtension::id));
        extensions = List.copyOf(enabled);
        chatProvider = chat;
        if (!extensions.isEmpty()) {
            LOG.info("Enabled extensions: {}", extensions.stream().map(RegisteredExtension::id).toList());
        }
    }

    private void warnAboutUnknownIds(Set<String> ids) {
        Set<String> unknownIds = new HashSet<>();
        for (String property : properties.getPropertyNames()) {
            settingId(property)
                    .filter(id -> !ids.contains(id) && !ExtensionManifestLoader.RESERVED_IDS.contains(id))
                    .filter(unknownIds::add)
                    .ifPresent(id -> LOG.warn("Extension settings name unknown extension id '{}'", id));
        }
    }

    /** The id that a per-id setting names. An id has no underscore, so an environment variable has one for each dash. */
    static Optional<String> settingId(String property) {
        Matcher match = PER_ID_SETTING.matcher(property);
        if (match.matches()) {
            return Optional.of(match.group(1) == null ? match.group(2) : match.group(1));
        }
        match = PER_ID_ENV_SETTING.matcher(property);
        if (match.matches()) {
            String id = match.group(1) == null ? match.group(2) : match.group(1);
            return Optional.of(id.toLowerCase(Locale.ROOT).replace('_', '-'));
        }
        return Optional.empty();
    }

    /**
     * The chat entry that the operator chose with {@code calm.extensions.chat-provider}. Hub never picks one itself, so
     * with no setting there is no chat in Hub UI.
     */
    public Optional<ChatProvider> chatProvider() {
        return Optional.ofNullable(chatProvider);
    }

    /** {@code <extension-id>} or {@code <extension-id>/<chat-entry-id>}, which must name a chat entry of an enabled extension. */
    private ChatProvider chatProvider(List<RegisteredExtension> enabled, List<String> errors) {
        String value = config.chatProvider().map(String::trim).filter(v -> !v.isEmpty()).orElse(null);
        if (value == null) {
            return null;
        }
        String[] parts = value.split("/", -1);
        String extensionId = parts[0];
        Optional<RegisteredExtension> extension = enabled.stream().filter(e -> e.id().equals(extensionId)).findFirst();
        List<ExtensionManifest.RouteContribution> entries = extension
                .map(e -> e.manifest().contributes().chat())
                .orElse(null);
        if (parts.length > 2 || entries == null || entries.isEmpty()) {
            errors.add("calm.extensions.chat-provider must name an enabled extension with a chat entry, as <extension-id> "
                    + "or <extension-id>/<chat-entry-id>");
            return null;
        }
        if (parts.length == 1) {
            if (entries.size() > 1) {
                errors.add("calm.extensions.chat-provider must name a chat entry of extension '" + extensionId
                        + "', which has more than one: <extension-id>/<chat-entry-id>");
                return null;
            }
            return new ChatProvider(extensionId, entries.getFirst().id());
        }
        Optional<ExtensionManifest.RouteContribution> entry = entries.stream().filter(e -> e.id().equals(parts[1])).findFirst();
        if (entry.isEmpty()) {
            errors.add("calm.extensions.chat-provider names a chat entry that extension '" + extensionId + "' does not declare");
            return null;
        }
        return new ChatProvider(extensionId, entry.get().id());
    }

    /** True on a read-only Hub, where the proxy allows a non-GET method only on a {@code readOnly} route. */
    public boolean isReadOnly() {
        return readOnly;
    }

    /** The enabled extensions in order, with the settings that only Hub may see. */
    public List<RegisteredExtension> enabled() {
        return extensions;
    }

    public Optional<RegisteredExtension> find(String id) {
        return extensions.stream().filter(e -> e.id().equals(id)).findFirst();
    }

    /**
     * The enabled manifests that this Hub can run, in order. A read-only Hub leaves out each write
     * route that is not {@code readOnly}, and the commands and contributions that use it (ADR 0011).
     */
    public List<ExtensionManifest> available() {
        return extensions.stream()
                .map(RegisteredExtension::manifest)
                .map(m -> readOnly ? m.withRoutes(r -> "GET".equals(r.method()) || r.readOnly()) : m)
                .toList();
    }

    private Optional<String> setting(String id, String name) {
        // The quoted form is the documented one; the plain form is accepted because ids have no dots.
        return properties.getOptionalValue(key(id, name), String.class)
                .or(() -> properties.getOptionalValue("calm.extensions." + id + "." + name, String.class))
                .map(String::trim);
    }

    private Optional<Boolean> booleanSetting(String id, String name, List<String> errors) {
        return setting(id, name).flatMap(value -> {
            if (value.equalsIgnoreCase("true") || value.equalsIgnoreCase("false")) {
                return Optional.of(Boolean.parseBoolean(value));
            }
            errors.add(key(id, name) + " must be true or false, but was '" + value + "'");
            return Optional.empty();
        });
    }

    private Optional<Integer> intSetting(String id, String name, List<String> errors) {
        return setting(id, name).flatMap(value -> {
            try {
                return Optional.of(Integer.parseInt(value));
            } catch (NumberFormatException e) {
                errors.add(key(id, name) + " must be an integer, but was '" + value + "'");
                return Optional.empty();
            }
        });
    }

    private Optional<URI> urlSetting(String id, String name, List<String> errors) {
        return setting(id, name).flatMap(value -> {
            try {
                URI uri = new URI(value);
                if (uri.getScheme() != null && URL_SCHEMES.contains(uri.getScheme().toLowerCase())
                        && uri.getHost() != null && uri.getRawUserInfo() == null
                        && uri.getRawQuery() == null && uri.getRawFragment() == null) {
                    return Optional.of(uri);
                }
            } catch (URISyntaxException e) {
                // Reported below.
            }
            errors.add(key(id, name) + " must be an absolute http or https URL with no user info, query or fragment");
            return Optional.empty();
        });
    }

    private ExtensionLimits limits(String id, List<String> errors) {
        ExtensionsConfig.Http defaults = config.http();
        return new ExtensionLimits(
                Duration.ofSeconds(positiveSetting(id, "connect-timeout-seconds", defaults.connectTimeoutSeconds(), errors)),
                Duration.ofSeconds(positiveSetting(id, "request-timeout-seconds", defaults.requestTimeoutSeconds(), errors)),
                positiveSetting(id, "max-request-bytes", defaults.maxRequestBytes(), errors),
                positiveSetting(id, "max-response-bytes", defaults.maxResponseBytes(), errors),
                positiveSetting(id, "max-concurrent-calls", defaults.maxConcurrentCalls(), errors),
                positiveSetting(id, "max-concurrent-streams", defaults.maxConcurrentStreams(), errors),
                Duration.ofSeconds(positiveSetting(id, "stream-idle-timeout-seconds", defaults.streamIdleTimeoutSeconds(), errors)),
                Duration.ofSeconds(positiveSetting(id, "max-stream-seconds", defaults.maxStreamSeconds(), errors)));
    }

    private int positiveSetting(String id, String name, int fallback, List<String> errors) {
        int value = intSetting(id, name, errors).orElse(fallback);
        if (value < 1) {
            errors.add(key(id, name) + " must be at least 1, but was " + value);
        }
        return value;
    }

    /** Only literal loopback names, so that no DNS answer can make a host count as loopback. */
    private static boolean isLoopback(String host) {
        String name = host.toLowerCase(Locale.ROOT);
        return name.equals("localhost") || name.equals("[::1]") || name.matches("127(\\.\\d{1,3}){3}");
    }

    private static String key(String id, String name) {
        return "calm.extensions.\"" + id + "\"." + name;
    }
}
