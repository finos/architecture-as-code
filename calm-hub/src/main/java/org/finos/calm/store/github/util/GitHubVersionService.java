package org.finos.calm.store.github.util;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.cache.CalmCacheService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
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
    private static final Pattern SHA_PATTERN = Pattern.compile("\"sha\"\\s*:\\s*\"([0-9a-f]{40})\"");

    @Inject
    CalmCacheService cache;

    @Inject
    @ConfigProperty(name = "calm.github.api-url", defaultValue = "https://api.github.com")
    String apiUrl;

    @Inject
    @ConfigProperty(name = "calm.github.service-token")
    Optional<String> serviceToken;

    public List<String> getFileVersions(String repoFullName, String filePath) {
        String cacheKey = "versions:" + repoFullName + ":" + filePath;
        Optional<List> cached = cache.get(cacheKey, List.class);
        if (cached.isPresent()) {
            @SuppressWarnings("unchecked")
            List<String> result = cached.get();
            return result;
        }

        try {
            String url = apiUrl + "/repos/" + repoFullName + "/commits?path=" + filePath + "&per_page=10";
            HttpClient client = HttpClient.newBuilder().proxy(ProxySelector.getDefault()).build();
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Accept", "application/json")
                    .GET();

            if (serviceToken.isPresent() && !serviceToken.get().isBlank()) {
                requestBuilder.header("Authorization", "Bearer " + serviceToken.get());
            }

            HttpResponse<String> response = client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOG.warn("GitHub API returned {} for commits on {}/{}", response.statusCode(), repoFullName, filePath);
                return List.of("latest");
            }

            List<String> shas = extractShas(response.body());
            if (shas.isEmpty()) {
                shas = List.of("latest");
            }
            // Reverse to chronological order (oldest first) — UI timeline expects left=oldest, right=newest
            List<String> chronological = new ArrayList<>(shas);
            java.util.Collections.reverse(chronological);
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
            HttpClient client = HttpClient.newBuilder().proxy(ProxySelector.getDefault()).build();
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Accept", "application/vnd.github.raw+json")
                    .GET();

            if (serviceToken.isPresent() && !serviceToken.get().isBlank()) {
                requestBuilder.header("Authorization", "Bearer " + serviceToken.get());
            }

            HttpResponse<String> response = client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOG.warn("GitHub API returned {} for content at SHA {} for {}/{}", response.statusCode(), sha, repoFullName, filePath);
                return null;
            }

            String content = response.body();
            // Content at a SHA is immutable — cache indefinitely
            cache.put(cacheKey, content, Duration.ofDays(365));
            return content;
        } catch (Exception e) {
            LOG.warn("Failed to fetch content at SHA {} for {}/{}: {}", sha, repoFullName, filePath, e.getMessage());
            return null;
        }
    }

    List<String> extractShas(String json) {
        List<String> shas = new ArrayList<>();
        Matcher matcher = SHA_PATTERN.matcher(json);
        while (matcher.find() && shas.size() < 10) {
            shas.add(matcher.group(1).substring(0, 7));
        }
        return shas;
    }
}
