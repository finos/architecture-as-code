package org.finos.calm.extensions;

import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.core.json.DecodeException;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.Config;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.ResolvedConventionDefault;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.resources.ResourceValidationConstants;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.services.ConventionService;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.ResourceMappingStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;

/**
 * Reads the {@code hubData} of a route and builds the body that Hub sends to the extension. Hub reads only what the
 * caller may read: the resource and the links in the namespace that it checked, and conventions in namespaces that
 * the caller can read. So an extension needs no account and no route back to Hub, and it can run outside the network
 * of the Hub, such as a service that FINOS hosts.
 */
@ApplicationScoped
public class ExtensionHubData {

    private static final Logger LOG = LoggerFactory.getLogger(ExtensionHubData.class);
    static final int MAX_DETAILED_ARCHITECTURES = 50;
    static final int MAX_EXTENDS = 8;
    private static final java.util.regex.Pattern VERSION =
            java.util.regex.Pattern.compile(ResourceValidationConstants.SNAPSHOT_VERSION_OR_SHA_REGEX);
    private static final java.util.regex.Pattern ARCHITECTURE_PATH =
            java.util.regex.Pattern.compile("^(?:/api)?/calm/namespaces/([^/]+)/architectures/([^/]+)/versions/([^/]+)$");
    private static final java.util.regex.Pattern CONVENTION_PATH =
            java.util.regex.Pattern.compile("^(?:/api)?/calm/namespaces/([^/]+)/conventions/([^/]+)/(\\d+)/versions/([^/]+)$");
    private static final String DEFAULT_BASE_URL = "http://localhost:8080";

    private final ArchitectureStore architectures;
    private final PatternStore patterns;
    private final ResourceMappingStore mappings;
    private final ConventionService conventions;
    private final CalmHubPermissionChecker permissions;
    private final URI baseUrl;

    @Inject
    public ExtensionHubData(ArchitectureStore architectures, PatternStore patterns, ResourceMappingStore mappings,
                            ConventionService conventions, CalmHubPermissionChecker permissions, Config properties) {
        this(architectures, patterns, mappings, conventions, permissions,
                properties.getOptionalValue("calm.hub.base-url", String.class).orElse(DEFAULT_BASE_URL));
    }

    ExtensionHubData(ArchitectureStore architectures, PatternStore patterns, ResourceMappingStore mappings,
                     ConventionService conventions, CalmHubPermissionChecker permissions, String baseUrl) {
        this.architectures = architectures;
        this.patterns = patterns;
        this.mappings = mappings;
        this.conventions = conventions;
        this.permissions = permissions;
        this.baseUrl = URI.create(baseUrl);
    }

    /**
     * The body for a route with {@code hubData}. {@code parameters} come from the matched path, whose namespace Hub
     * checked for the read scope.
     */
    public byte[] body(SecurityIdentity identity, ExtensionManifest.Route route, Map<String, String> parameters,
                       String rawQuery) {
        String namespace = parameters.get("namespace");
        String resourceType = parameters.get("resourceType");
        String resourceId = parameters.get("resourceId");
        JsonObject body = new JsonObject().put("hubApi", 0);
        JsonObject linked = new JsonObject();
        if (route.hubData().contains(ExtensionManifest.Route.DOCUMENT)) {
            String version = queryValue(rawQuery, "version")
                    .orElseThrow(() -> new ExtensionProxyException(400, "This route needs the version of the resource"));
            if (!VERSION.matcher(version).matches()) {
                throw new ExtensionProxyException(400, "The version is not valid");
            }
            JsonObject document = read(namespace, resourceType, resourceId, version)
                    .orElseThrow(() -> new ExtensionProxyException(404, "There is no such resource version"));
            body.put("document", document);
            if (route.hubData().contains(ExtensionManifest.Route.DETAILED_ARCHITECTURES)) {
                addDetailedArchitectures(document, namespace, linked);
            }
        }
        JsonObject named = new JsonObject();
        for (String name : route.hubData()) {
            ConventionType.fromName(name).ifPresent(type -> addConvention(identity, namespace, type, named, linked));
        }
        if (!named.isEmpty()) {
            body.put("conventions", named);
        }
        if (!linked.isEmpty()) {
            body.put("linked", linked);
        }
        return body.encode().getBytes(StandardCharsets.UTF_8);
    }

    private Optional<JsonObject> read(String namespace, String resourceType, String id, String version) {
        try {
            String text = switch (resourceType) {
                case "architectures" -> architectures.getArchitectureForVersion(new Architecture.ArchitectureBuilder()
                        .setNamespace(namespace).setId(numericId(namespace, ResourceType.ARCHITECTURE, id)).setVersion(version).build());
                case "patterns" -> patterns.getPatternForVersion(new Pattern.PatternBuilder()
                        .setNamespace(namespace).setId(numericId(namespace, ResourceType.PATTERN, id)).setVersion(version).build());
                default -> throw new ExtensionProxyException(400, "Hub sends the document of an architecture or a pattern only");
            };
            return Optional.of(new JsonObject(text));
        } catch (ExtensionProxyException e) {
            throw e;
        } catch (DecodeException | ClassCastException e) {
            LOG.warn("The {} {}/{} version {} is not a JSON object", resourceType, namespace, id, version);
            return Optional.empty();
        } catch (Exception e) {
            // Not found: no namespace, no resource, no version or no custom id.
            return Optional.empty();
        }
    }

    /** A numeric id, or a custom id of the name-based API. */
    private int numericId(String namespace, ResourceType type, String id) throws Exception {
        return id.matches("\\d{1,9}") ? Integer.parseInt(id) : mappings.getMapping(namespace, type, id).getNumericId();
    }

    /** The detailed architectures that the nodes link to, on this Hub and in the same namespace, keyed by the link. */
    private void addDetailedArchitectures(JsonObject document, String namespace, JsonObject linked) {
        var nodes = document.getValue("nodes") instanceof io.vertx.core.json.JsonArray array ? array : null;
        if (nodes == null) {
            return;
        }
        int count = 0;
        for (Object item : nodes) {
            if (count >= MAX_DETAILED_ARCHITECTURES) {
                break;
            }
            if (!(item instanceof JsonObject node) || !(node.getValue("details") instanceof JsonObject details)
                    || !(details.getValue("detailed-architecture") instanceof String link) || linked.containsKey(link)) {
                continue;
            }
            Optional<Matcher> match = hubPath(link).map(ARCHITECTURE_PATH::matcher).filter(Matcher::matches);
            // The caller's read scope covers this namespace only.
            if (match.isEmpty() || !namespace.equals(decode(match.get().group(1)))) {
                continue;
            }
            Matcher m = match.get();
            count++;
            read(namespace, "architectures", decode(m.group(2)), decode(m.group(3))).ifPresent(child -> linked.put(link, child));
        }
    }

    private void addConvention(SecurityIdentity identity, String namespace, ConventionType type, JsonObject named,
                               JsonObject linked) {
        Optional<ResolvedConventionDefault> found;
        try {
            found = conventions.resolveDefault(namespace, type);
        } catch (Exception e) {
            return;
        }
        if (found.isEmpty()) {
            return;
        }
        ResolvedConventionDefault resolved = found.get();
        JsonObject convention = new JsonObject(resolved.convention().toString());
        named.put(type.getName(), new JsonObject()
                .put("namespace", resolved.namespace())
                .put("conventionId", resolved.conventionId())
                .put("version", resolved.version())
                .put("inherited", resolved.inherited())
                .put("convention", convention));
        // Each convention on this Hub that the default extends, so the extension resolves the chain with no request.
        Set<String> seen = new HashSet<>();
        Object next = convention.getValue("extends");
        while (next instanceof String link && seen.size() < MAX_EXTENDS && seen.add(link)) {
            Optional<Matcher> match = hubPath(link).map(CONVENTION_PATH::matcher).filter(Matcher::matches);
            if (match.isEmpty() || !type.getName().equals(decode(match.get().group(2)))) {
                return;
            }
            Matcher m = match.get();
            String ns = decode(m.group(1));
            if (!permissions.canRead(identity, ns)) {
                return;
            }
            JsonObject parent;
            try {
                parent = new JsonObject(conventions.getConventionForVersion(ns, type, Integer.parseInt(m.group(3)), decode(m.group(4))));
            } catch (Exception e) {
                return;
            }
            linked.put(link, parent);
            next = parent.getValue("extends");
        }
    }

    /** The path of a link to this Hub: a path, or an absolute URL with the scheme, host and port of calm.hub.base-url. */
    Optional<String> hubPath(String link) {
        try {
            URI uri = URI.create(link);
            if (uri.getScheme() == null && uri.getHost() == null) {
                return Optional.ofNullable(uri.getRawPath()).filter(path -> path.startsWith("/"));
            }
            boolean sameHub = baseUrl.getScheme().equalsIgnoreCase(uri.getScheme())
                    && baseUrl.getHost().equalsIgnoreCase(uri.getHost()) && port(baseUrl) == port(uri);
            return sameHub ? Optional.ofNullable(uri.getRawPath()) : Optional.empty();
        } catch (IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
    }

    private static int port(URI uri) {
        return uri.getPort() >= 0 ? uri.getPort() : "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }

    private static String decode(String segment) {
        return URLDecoder.decode(segment, StandardCharsets.UTF_8);
    }

    static Optional<String> queryValue(String rawQuery, String name) {
        if (rawQuery == null || rawQuery.isEmpty()) {
            return Optional.empty();
        }
        try {
            for (String pair : rawQuery.split("&")) {
                int equals = pair.indexOf('=');
                String key = decode(equals < 0 ? pair : pair.substring(0, equals));
                if (key.equals(name) && equals >= 0) {
                    return Optional.of(decode(pair.substring(equals + 1)));
                }
            }
        } catch (IllegalArgumentException e) {
            throw new ExtensionProxyException(400, "The query has an escape that is not valid");
        }
        return Optional.empty();
    }
}
