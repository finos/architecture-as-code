package org.finos.calm.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Optional;

/**
 * Encapsulates OIDC HTTP operations for the plugin authentication flow.
 * Handles discovery document fetching, authorize URL construction, and
 * authorization code exchange. Injectable seam for unit testing
 * PluginAuthResource without real HTTP calls.
 */
@ApplicationScoped
public class OidcPluginAuthClient {

    private static final Logger LOG = LoggerFactory.getLogger(OidcPluginAuthClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    @ConfigProperty(name = "calm.github.http.connect-timeout", defaultValue = "10")
    int connectTimeoutSeconds;

    @Inject
    @ConfigProperty(name = "calm.github.http.request-timeout", defaultValue = "30")
    int requestTimeoutSeconds;

    public record OidcEndpoints(String authorizationEndpoint, String tokenEndpoint) {}

    public record TokenResponse(String accessToken, String idToken, String error) {}

    /**
     * Fetches the OIDC discovery document and extracts authorization_endpoint and token_endpoint.
     *
     * @param issuerUrl the OIDC issuer URL (auth-server-url)
     * @return discovered endpoints, or null if discovery fails
     */
    public OidcEndpoints discoverEndpoints(String issuerUrl) {
        try {
            String discoveryUrl = issuerUrl.endsWith("/")
                    ? issuerUrl + ".well-known/openid-configuration"
                    : issuerUrl + "/.well-known/openid-configuration";

            HttpClient client = HttpClient.newBuilder()
                    .proxy(ProxySelector.getDefault())
                    .connectTimeout(Duration.ofSeconds(connectTimeoutSeconds))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(discoveryUrl))
                    .timeout(Duration.ofSeconds(requestTimeoutSeconds))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

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

            return new OidcEndpoints(authEndpoint, tokenEndpoint);
        } catch (Exception e) {
            LOG.error("OIDC discovery exception for issuer {}: {}", issuerUrl, e.getMessage());
            return null;
        }
    }

    /**
     * Exchanges an authorization code for tokens at the OIDC token endpoint.
     *
     * @param tokenEndpoint the token endpoint URL
     * @param clientId      the OIDC client ID
     * @param clientSecret  the OIDC client secret
     * @param code          the authorization code
     * @param redirectUri   the redirect URI used in the authorize request
     * @param codeVerifier  the PKCE code verifier (nullable for non-PKCE flows)
     * @return token response containing the access token or an error
     */
    public TokenResponse exchangeCode(String tokenEndpoint, String clientId, String clientSecret,
                                      String code, String redirectUri, String codeVerifier) {
        try {
            String body = "grant_type=authorization_code"
                    + "&client_id=" + clientId
                    + "&code=" + code
                    + "&redirect_uri=" + redirectUri;
            if (clientSecret != null && !clientSecret.isBlank()) {
                body += "&client_secret=" + clientSecret;
            }
            if (codeVerifier != null && !codeVerifier.isBlank()) {
                body += "&code_verifier=" + codeVerifier;
            }

            HttpClient client = HttpClient.newBuilder()
                    .proxy(ProxySelector.getDefault())
                    .connectTimeout(Duration.ofSeconds(connectTimeoutSeconds))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(tokenEndpoint))
                    .timeout(Duration.ofSeconds(requestTimeoutSeconds))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOG.error("OIDC token exchange failed with status {}: {}", response.statusCode(), response.body());
                return new TokenResponse(null, null, "Token exchange failed with status " + response.statusCode());
            }

            JsonNode json = MAPPER.readTree(response.body());
            String accessToken = extractTextField(json, "access_token");
            String idToken = extractTextField(json, "id_token");

            if (accessToken == null) {
                LOG.error("No access_token in OIDC token response");
                return new TokenResponse(null, null, "No access token in response");
            }

            return new TokenResponse(accessToken, idToken, null);
        } catch (Exception e) {
            LOG.error("OIDC token exchange exception", e);
            return new TokenResponse(null, null, "Token exchange failed: " + e.getMessage());
        }
    }

    private String extractTextField(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? value.asText() : null;
    }
}
