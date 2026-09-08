package org.finos.calm.store.github.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.cache.CalmCacheService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches file version history (commit SHAs) from the GitHub REST API.
 * Results are cached — version lists for 5 min, content at SHA indefinitely (immutable).
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubVersionService {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubVersionService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern LINK_NEXT_PATTERN = Pattern.compile("<([^>]+)>;\\s*rel=\"next\"");

    @Inject
    CalmCacheService cache;

    @Inject
    @ConfigProperty(name = "calm.github.api-url", defaultValue = "https://api.github.com")
    String apiUrl;

    @Inject
    @ConfigProperty(name = "calm.github.service-token")
    Optional<String> serviceToken;

    @Inject
    @ConfigProperty(name = "calm.github.http.connect-timeout", defaultValue = "10")
    int connectTimeoutSeconds;

    @Inject
    @ConfigProperty(name = "calm.github.http.request-timeout", defaultValue = "30")
    int requestTimeoutSeconds;

    @Inject
    @ConfigProperty(name = "calm.github.max-versions", defaultValue = "100")
    int maxVersions;

    public List<String> getFileVersions(String repoFullName, String filePath) {
        String cacheKey = "versions:" + repoFullName + ":" + filePath;
        Optional<List> cached = cache.get(cacheKey, List.class);
        if (cached.isPresent()) {
            @SuppressWarnings("unchecked")
            List<String> result = cached.get();
            return result;
        }

        try {
            HttpClient client = HttpClient.newBuilder()
                    .proxy(ProxySelector.getDefault())
                    .connectTimeout(Duration.ofSeconds(connectTimeoutSeconds))
                    .build();

            List<String> allShas = new ArrayList<>();
            String url = apiUrl + "/repos/" + repoFullName + "/commits?path=" + filePath + "&per_page=100";

            while (url != null && allShas.size() < maxVersions) {
                HttpRequest request = buildRequest(url);
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() != 200) {
                    LOG.warn("GitHub API returned {} for commits on {}/{}", response.statusCode(), repoFullName, filePath);
                    break;
                }

                List<String> pageShas = extractShas(response.body(), maxVersions - allShas.size());
                allShas.addAll(pageShas);
                url = extractNextLink(response.headers());
            }

            if (allShas.isEmpty()) {
                allShas = List.of("latest");
            }
            List<String> chronological = new ArrayList<>(allShas);
            Collections.reverse(chronological);
            cache.put(cacheKey, chronological, Duration.ofMinutes(5));
            return chronological;
        } catch (Exception e) {
            LOG.warn("Failed to fetch versions for {}/{}: {}", repoFullName, filePath, e.getMessage());
            return List.of("latest");
        }
    }

    public String getFileAtVersion(String repoFullName, String filePath, String sha) {
        String cacheKey = "content:" + repoFullName + ":" + filePath + ":" + sha;
        Optional<String> cached = cache.get(cacheKey, String.class);
        if (cached.isPresent()) {
            return cached.get();
        }

        try {
            String url = apiUrl + "/repos/" + repoFullName + "/contents/" + filePath + "?ref=" + sha;
            HttpClient client = HttpClient.newBuilder()
                    .proxy(ProxySelector.getDefault())
                    .connectTimeout(Duration.ofSeconds(connectTimeoutSeconds))
                    .build();
            HttpRequest request = buildRequest(url, "application/vnd.github.raw+json");

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOG.warn("GitHub API returned {} for content at SHA {} for {}/{}", response.statusCode(), sha, repoFullName, filePath);
                return null;
            }

            String content = response.body();
            cache.put(cacheKey, content, Duration.ofDays(365));
            return content;
        } catch (Exception e) {
            LOG.warn("Failed to fetch content at SHA {} for {}/{}: {}", sha, repoFullName, filePath, e.getMessage());
            return null;
        }
    }

    List<String> extractShas(String json, int limit) {
        List<String> shas = new ArrayList<>();
        try {
            JsonNode commits = MAPPER.readTree(json);
            if (commits.isArray()) {
                for (JsonNode commit : commits) {
                    JsonNode shaNode = commit.get("sha");
                    if (shaNode != null && shaNode.isTextual() && shas.size() < limit) {
                        String fullSha = shaNode.asText();
                        shas.add(fullSha.length() >= 7 ? fullSha.substring(0, 7) : fullSha);
                    }
                }
            }
        } catch (Exception e) {
            LOG.warn("Failed to parse commits JSON: {}", e.getMessage());
        }
        return shas;
    }

    String extractNextLink(HttpHeaders headers) {
        Optional<String> linkHeader = headers.firstValue("Link");
        if (linkHeader.isEmpty()) {
            return null;
        }
        Matcher matcher = LINK_NEXT_PATTERN.matcher(linkHeader.get());
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    private HttpRequest buildRequest(String url) {
        return buildRequest(url, "application/json");
    }

    private HttpRequest buildRequest(String url, String accept) {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(requestTimeoutSeconds))
                .header("Accept", accept)
                .GET();

        if (serviceToken.isPresent() && !serviceToken.get().isBlank()) {
            requestBuilder.header("Authorization", "Bearer " + serviceToken.get());
        }

        return requestBuilder.build();
    }
}
