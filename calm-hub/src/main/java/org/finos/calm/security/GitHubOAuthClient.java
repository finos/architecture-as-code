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
 * Encapsulates GitHub OAuth HTTP operations (token exchange, user lookup).
 * Injectable seam for unit testing GitHubLinkResource without real HTTP.
 */
@ApplicationScoped
public class GitHubOAuthClient {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubOAuthClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    @ConfigProperty(name = "calm.github.oauth.base-url", defaultValue = "https://github.com")
    String githubBaseUrl;

    @Inject
    @ConfigProperty(name = "calm.github.api-url", defaultValue = "https://api.github.com")
    String githubApiUrl;

    @Inject
    @ConfigProperty(name = "calm.github.http.connect-timeout", defaultValue = "10")
    int connectTimeoutSeconds;

    @Inject
    @ConfigProperty(name = "calm.github.http.request-timeout", defaultValue = "30")
    int requestTimeoutSeconds;

    public record TokenResponse(String accessToken, String error) {}

    public TokenResponse exchangeCode(String clientId, String clientSecret, String code) {
        try {
            String tokenUrl = githubBaseUrl + "/login/oauth/access_token";
            String body = "client_id=" + clientId
                    + "&client_secret=" + clientSecret
                    + "&code=" + code;

            HttpClient client = HttpClient.newBuilder().proxy(ProxySelector.getDefault()).connectTimeout(Duration.ofSeconds(connectTimeoutSeconds)).build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(tokenUrl))
                    .timeout(Duration.ofSeconds(requestTimeoutSeconds))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOG.error("GitHub token exchange failed with status {}: {}", response.statusCode(), response.body());
                return new TokenResponse(null, "GitHub token exchange failed");
            }

            String token = extractJsonField(response.body(), "access_token");
            if (token == null || token.isBlank()) {
                LOG.error("No access_token in GitHub response: {}", response.body());
                return new TokenResponse(null, "No access token in GitHub response");
            }
            return new TokenResponse(token, null);
        } catch (Exception e) {
            LOG.error("GitHub token exchange exception", e);
            return new TokenResponse(null, "GitHub token exchange failed: " + e.getMessage());
        }
    }

    public String fetchUsername(String token) {
        try {
            HttpClient client = HttpClient.newBuilder().proxy(ProxySelector.getDefault()).connectTimeout(Duration.ofSeconds(connectTimeoutSeconds)).build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(githubApiUrl + "/user"))
                    .timeout(Duration.ofSeconds(requestTimeoutSeconds))
                    .header("Authorization", "Bearer " + token)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            String login = extractJsonField(response.body(), "login");
            return login != null ? login : "unknown";
        } catch (Exception e) {
            LOG.warn("Could not fetch GitHub username: {}", e.getMessage());
            return "unknown";
        }
    }

    private String extractJsonField(String json, String field) {
        try {
            JsonNode node = MAPPER.readTree(json).get(field);
            return node != null && node.isTextual() ? node.asText() : null;
        } catch (Exception e) {
            LOG.warn("Failed to parse GitHub response field {}", field);
            return null;
        }
    }
}
