package org.finos.calm.store.github.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.github.config.GitHubStoreConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.ProxySelector;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * REST client fetching file version history (commit SHAs) and file content from the
 * GitHub API. Results are cached via {@link GitHubApiResponseCache} — see that class for
 * the caching contract and its cross-instance staleness scope.
 *
 * <p>Never fabricates a version. On any failure to determine real commit history —
 * the API unreachable, a non-200 response, an empty result — {@link #getFileVersions}
 * returns an empty list, not a placeholder value. A version list may only ever contain
 * versions the store can actually resolve; see the read-block design in the GitHub
 * stores that consume this for how an empty list and a genuine SHA are told apart on
 * read (namespace/#3066 review discussion — "latest" was removed as a sentinel value
 * for exactly this reason).</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubFileHistoryClient {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubFileHistoryClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern LINK_NEXT_PATTERN = Pattern.compile("<([^>]+)>;\\s*rel=\"next\"");

    private final GitHubApiResponseCache cache;
    private final GitHubStoreConfig storeConfig;
    private final int requestTimeoutSeconds;
    private final int maxVersions;
    private final HttpClient httpClient;

    @Inject
    public GitHubFileHistoryClient(GitHubApiResponseCache cache,
                                    GitHubStoreConfig storeConfig,
                                    @ConfigProperty(name = "calm.github.http.connect-timeout", defaultValue = "10") int connectTimeoutSeconds,
                                    @ConfigProperty(name = "calm.github.http.request-timeout", defaultValue = "30") int requestTimeoutSeconds,
                                    @ConfigProperty(name = "calm.github.max-versions", defaultValue = "100") int maxVersions) {
        this.cache = cache;
        this.storeConfig = storeConfig;
        this.requestTimeoutSeconds = requestTimeoutSeconds;
        this.maxVersions = maxVersions;
        // Built here rather than in a separate lifecycle step: constructor injection
        // means connectTimeoutSeconds is already resolved by the time this line runs,
        // unlike the field + @PostConstruct split this class used to need (a field
        // initializer would have read @ConfigProperty's pre-injection default of 0).
        // Built once and reused, not per-call, so requests share a connection pool.
        this.httpClient = HttpClient.newBuilder()
                .proxy(ProxySelector.getDefault())
                .connectTimeout(Duration.ofSeconds(connectTimeoutSeconds))
                .build();
    }

    /**
     * @param branch part of the cache key alongside repoFullName/filePath, and sent
     *               as the commits API's {@code sha} parameter - without it, two
     *               namespaces mapped to the same repo on different branches would
     *               share one cache entry holding whichever branch's history was
     *               fetched first, and the API call itself would always return the
     *               default branch's history regardless of which branch is configured.
     * @return commit SHAs oldest-first, truncated to 7 characters; empty if none could
     * be determined — never a placeholder value (see class javadoc)
     */
    public List<String> getFileVersions(String repoFullName, String branch, String filePath) {
        Optional<List<String>> cached = cache.getVersions(repoFullName, branch, filePath);
        if (cached.isPresent()) {
            return cached.get();
        }

        try {
            List<String> allShas = new ArrayList<>();
            String url = storeConfig.getApiUrl() + "/repos/" + repoFullName + "/commits?path="
                    + encodePathSegment(filePath) + "&sha=" + encodeQueryValue(branch) + "&per_page=100";

            while (url != null && allShas.size() < maxVersions) {
                HttpRequest request = buildRequest(url);
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() != 200) {
                    LOG.warn("GitHub API returned {} for commits on {}/{}", response.statusCode(), repoFullName, filePath);
                    break;
                }

                List<String> pageShas = extractShas(response.body(), maxVersions - allShas.size());
                allShas.addAll(pageShas);
                url = nextPageUrl(response.headers());
            }

            List<String> chronological = new ArrayList<>(allShas);
            Collections.reverse(chronological);
            cache.putVersions(repoFullName, branch, filePath, chronological);
            return chronological;
        } catch (Exception e) {
            LOG.warn("Failed to fetch versions for {}/{}: {}", repoFullName, filePath, e.getMessage());
            return List.of();
        }
    }

    public String getFileAtVersion(String repoFullName, String filePath, String sha) {
        Optional<String> cached = cache.getContentAtSha(repoFullName, filePath, sha);
        if (cached.isPresent()) {
            return cached.get();
        }

        try {
            String url = storeConfig.getApiUrl() + "/repos/" + repoFullName + "/contents/"
                    + encodePathSegment(filePath) + "?ref=" + encodeQueryValue(sha);
            HttpRequest request = buildRequest(url, "application/vnd.github.raw+json");

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOG.warn("GitHub API returned {} for content at SHA {} for {}/{}", response.statusCode(), sha, repoFullName, filePath);
                return null;
            }

            String content = response.body();
            cache.putContentAtSha(repoFullName, filePath, sha, content);
            return content;
        } catch (Exception e) {
            LOG.warn("Failed to fetch content at SHA {} for {}/{}: {}", sha, repoFullName, filePath, e.getMessage());
            return null;
        }
    }

    // Percent-encodes a repo-controlled relative path as a sequence of URL path
    // segments (preserving "/" as a separator, encoding everything else) - filePath
    // comes from the repo's own tree (ResourceRegistry), not a request, so a
    // file named e.g. "x?ref=other&y" must not be able to inject extra query
    // parameters or alter the request the way an unencoded concatenation would.
    private static String encodePathSegment(String relativePath) {
        return java.util.Arrays.stream(relativePath.split("/", -1))
                .map(segment -> URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20"))
                .reduce((a, b) -> a + "/" + b)
                .orElse("");
    }

    private static String encodeQueryValue(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private List<String> extractShas(String json, int limit) {
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

    private String extractNextLink(HttpHeaders headers) {
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

    // Only follows a Link: rel="next" URL whose host matches the configured API host -
    // extractNextLink alone would re-attach the Authorization: Bearer <service-token>
    // header (via buildRequest) to whatever host the upstream response names.
    private String nextPageUrl(HttpHeaders headers) {
        String next = extractNextLink(headers);
        if (next == null) {
            return null;
        }
        try {
            String nextHost = URI.create(next).getHost();
            String configuredHost = URI.create(storeConfig.getApiUrl()).getHost();
            if (nextHost == null || !nextHost.equalsIgnoreCase(configuredHost)) {
                LOG.warn("Ignoring GitHub API Link header pointing at a different host ({}) than the configured api-url ({})",
                        nextHost, configuredHost);
                return null;
            }
        } catch (IllegalArgumentException e) {
            LOG.warn("Ignoring unparsable GitHub API Link header: {}", e.getMessage());
            return null;
        }
        return next;
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

        String serviceToken = storeConfig.getServiceToken();
        if (serviceToken != null && !serviceToken.isBlank()) {
            requestBuilder.header("Authorization", "Bearer " + serviceToken);
        }

        return requestBuilder.build();
    }
}
