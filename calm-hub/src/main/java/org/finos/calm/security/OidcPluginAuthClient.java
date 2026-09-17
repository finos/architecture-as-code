package org.finos.calm.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Encapsulates OIDC discovery for the plugin authentication flow. Token exchange itself
 * happens browser-side in {@code PluginAuthResource}'s callback page — the IdP app
 * registration this targets may be SPA-only, which permits browser-side authorization-code
 * redemption but rejects a server-side POST, so this class deliberately does not perform
 * the exchange itself.
 *
 * <p>The discovery document is cached indefinitely per instance: it is IdP metadata that
 * essentially never changes, and both public, unauthenticated plugin-auth endpoints call
 * {@link #discoverEndpoints(String)} on every hit — without caching, that's an unbounded
 * amplification vector from anonymous traffic to the IdP.
 */
@ApplicationScoped
public class OidcPluginAuthClient {

    private static final Logger LOG = LoggerFactory.getLogger(OidcPluginAuthClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    @ConfigProperty(name = "calm.oidc.http.connect-timeout", defaultValue = "10")
    int connectTimeoutSeconds;

    @Inject
    @ConfigProperty(name = "calm.oidc.http.request-timeout", defaultValue = "30")
    int requestTimeoutSeconds;

    // Built in @PostConstruct, not as a field initializer: connectTimeoutSeconds is
    // @ConfigProperty-injected, which happens after the constructor runs but before
    // @PostConstruct — a field initializer here would read the pre-injection default (0).
    private HttpClient httpClient;

    // Keyed implicitly by "the one issuer this deployment is configured for" — a single
    // cached entry is enough since calm-hub only ever talks to one IdP per running instance.
    private final AtomicReference<CachedDiscovery> discoveryCache = new AtomicReference<>();

    @PostConstruct
    void init() {
        httpClient = HttpClient.newBuilder()
                .proxy(ProxySelector.getDefault())
                .connectTimeout(Duration.ofSeconds(connectTimeoutSeconds))
                .build();
    }

    public record OidcEndpoints(String authorizationEndpoint, String tokenEndpoint) {}

    private record CachedDiscovery(String issuerUrl, OidcEndpoints endpoints) {}

    /**
     * Fetches the OIDC discovery document and extracts authorization_endpoint and token_endpoint,
     * caching the result for subsequent calls with the same {@code issuerUrl}.
     *
     * @param issuerUrl the OIDC issuer URL (auth-server-url)
     * @return discovered endpoints, or null if discovery fails
     */
    public OidcEndpoints discoverEndpoints(String issuerUrl) {
        CachedDiscovery cached = discoveryCache.get();
        if (cached != null && cached.issuerUrl().equals(issuerUrl)) {
            return cached.endpoints();
        }

        try {
            String discoveryUrl = issuerUrl.endsWith("/")
                    ? issuerUrl + ".well-known/openid-configuration"
                    : issuerUrl + "/.well-known/openid-configuration";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(discoveryUrl))
                    .timeout(Duration.ofSeconds(requestTimeoutSeconds))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOG.error("OIDC discovery failed with status {}: {}", response.statusCode(), response.body());
                return null;
            }

            JsonNode doc = MAPPER.readTree(response.body());
            String authEndpoint = extractTextField(doc, "authorization_endpoint");
            String tokenEndpoint = extractTextField(doc, "token_endpoint");

            if (authEndpoint == null || tokenEndpoint == null) {
                LOG.error("OIDC discovery document missing required endpoints");
                return null;
            }

            OidcEndpoints endpoints = new OidcEndpoints(authEndpoint, tokenEndpoint);
            discoveryCache.set(new CachedDiscovery(issuerUrl, endpoints));
            return endpoints;
        } catch (Exception e) {
            LOG.error("OIDC discovery exception for issuer {}: {}", issuerUrl, e.getMessage());
            return null;
        }
    }

    private String extractTextField(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? value.asText() : null;
    }
}
