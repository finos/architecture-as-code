package org.finos.calm.store.github.api;

import com.sun.net.httpserver.HttpServer;
import org.finos.calm.store.github.config.GitHubStoreConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Exercises {@link GitHubFileHistoryClient} entirely through its public API
 * ({@link GitHubFileHistoryClient#getFileVersions} / {@link GitHubFileHistoryClient#getFileAtVersion})
 * against a real local {@link HttpServer} rather than reaching into package-private
 * helpers — {@code extractShas}/{@code extractNextLink} are private, and every branch
 * they have is reachable from the public surface.
 */
@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestGitHubFileHistoryClientShould {

    @Mock
    private GitHubApiResponseCache cache;

    private HttpServer server;

    @AfterEach
    void teardown() {
        if (server != null) {
            server.stop(0);
        }
    }

    private GitHubFileHistoryClient clientFor(String apiUrl) {
        return clientFor(apiUrl, "test-token", 100);
    }

    private GitHubFileHistoryClient clientFor(String apiUrl, String serviceToken, int maxVersions) {
        GitHubStoreConfig storeConfig = new GitHubStoreConfig(serviceToken, "/tmp/calm-hub-clones", apiUrl);
        return new GitHubFileHistoryClient(cache, storeConfig, 10, 10, maxVersions);
    }

    private GitHubFileHistoryClient fastTimeoutClientFor(String apiUrl) {
        GitHubStoreConfig storeConfig = new GitHubStoreConfig("test-token", "/tmp/calm-hub-clones", apiUrl);
        // A closed local port can hang until the connect/request timeout rather than
        // refusing instantly - keep this test fast rather than waiting out the
        // production 10s/30s defaults.
        return new GitHubFileHistoryClient(cache, storeConfig, 1, 1, 100);
    }

    @Test
    void return_cached_versions_when_available() {
        List<String> cachedVersions = List.of("abc1234", "def5678");
        when(cache.getVersions("org/repo", "main", "path/file.json")).thenReturn(Optional.of(cachedVersions));

        GitHubFileHistoryClient client = clientFor("https://api.github.com");
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, equalTo(cachedVersions));
    }

    @Test
    void return_empty_list_when_the_commits_api_returns_no_commits() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/commits", exchange -> {
            byte[] body = "[]".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort());
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, is(empty()));
    }

    @Test
    void return_empty_list_for_a_malformed_commits_response() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/commits", exchange -> {
            byte[] body = "not valid json".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort());
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, is(empty()));
    }

    @Test
    void return_empty_list_when_the_commits_request_connection_fails() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        server = HttpServer.create(new InetSocketAddress(0), 0);
        int freedPort = server.getAddress().getPort();
        server.stop(0);
        server = null;

        GitHubFileHistoryClient client = fastTimeoutClientFor("http://localhost:" + freedPort);
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, is(empty()));
    }

    @Test
    void not_send_an_authorization_header_when_the_service_token_is_blank() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        AtomicReference<String> capturedAuthHeader = new AtomicReference<>("not-set");
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/commits", exchange -> {
            capturedAuthHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = "[]".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort(), "", 100);
        client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(capturedAuthHeader.get(), is(nullValue()));
    }

    @Test
    void send_a_bearer_authorization_header_when_the_service_token_is_present() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        AtomicReference<String> capturedAuthHeader = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/commits", exchange -> {
            capturedAuthHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = "[]".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort(), "ghp_secret", 100);
        client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(capturedAuthHeader.get(), equalTo("Bearer ghp_secret"));
    }

    @Test
    void extract_abbreviated_seven_character_shas_from_the_commits_response() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        String sha1 = "abcdef1234567890abcdef1234567890abcdef12";
        String sha2 = "1234567890abcdef1234567890abcdef12345678";
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/commits", exchange -> {
            byte[] body = ("[{\"sha\":\"" + sha1 + "\",\"commit\":{}},{\"sha\":\"" + sha2 + "\",\"commit\":{}}]")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort());
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, contains("1234567", "abcdef1"));
    }

    @Test
    void limit_to_the_configured_max_versions() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < 15; i++) {
            if (i > 0) json.append(",");
            json.append(String.format("{\"sha\":\"%040x\"}", i));
        }
        json.append("]");

        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/commits", exchange -> {
            byte[] body = json.toString().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort(), "test-token", 5);
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, hasSize(5));
    }

    @Test
    void follow_pagination_across_multiple_pages_on_the_same_host() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        AtomicInteger callCount = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/commits", exchange -> {
            int call = callCount.incrementAndGet();
            byte[] body;
            if (call == 1) {
                body = "[{\"sha\":\"1111111111111111111111111111111111111111\"}]".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Link",
                        "<http://localhost:" + server.getAddress().getPort() + "/repos/org/repo/commits?page=2>; rel=\"next\"");
            } else {
                body = "[{\"sha\":\"2222222222222222222222222222222222222222\"}]".getBytes(StandardCharsets.UTF_8);
            }
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort());
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(callCount.get(), equalTo(2));
        assertThat(result, contains("2222222", "1111111"));
    }

    @Test
    void stop_paginating_when_no_link_header_is_present() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        AtomicInteger callCount = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/commits", exchange -> {
            callCount.incrementAndGet();
            byte[] body = "[{\"sha\":\"1111111111111111111111111111111111111111\"}]".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort());
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(callCount.get(), equalTo(1));
        assertThat(result, contains("1111111"));
    }

    @Test
    void stop_paginating_when_the_next_link_points_at_a_different_host() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicInteger callCount = new AtomicInteger();
        server.createContext("/repos/org/repo/commits", exchange -> {
            callCount.incrementAndGet();
            byte[] body = "[{\"sha\":\"1111111111111111111111111111111111111111\"}]".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Link", "<http://evil.example.com/repos/org/repo/commits?page=2>; rel=\"next\"");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort());
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(callCount.get(), equalTo(1));
        assertThat(result, contains("1111111"));
    }

    @Test
    void stop_paginating_when_the_next_link_is_unparsable() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        server = HttpServer.create(new InetSocketAddress(0), 0);
        AtomicInteger callCount = new AtomicInteger();
        server.createContext("/repos/org/repo/commits", exchange -> {
            callCount.incrementAndGet();
            byte[] body = "[{\"sha\":\"1111111111111111111111111111111111111111\"}]".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Link", "<not a valid uri with spaces>; rel=\"next\"");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort());
        List<String> result = client.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(callCount.get(), equalTo(1));
        assertThat(result, contains("1111111"));
    }

    @Test
    void return_cached_content_at_sha_when_available() {
        when(cache.getContentAtSha("org/repo", "path/file.json", "abc1234"))
                .thenReturn(Optional.of("{\"cached\":true}"));

        GitHubFileHistoryClient client = clientFor("https://api.github.com");
        String content = client.getFileAtVersion("org/repo", "path/file.json", "abc1234");

        assertThat(content, equalTo("{\"cached\":true}"));
    }

    @Test
    void return_null_when_api_returns_non_200_for_content_at_sha() throws Exception {
        when(cache.getContentAtSha(any(), any(), any())).thenReturn(Optional.empty());

        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/contents/path/file.json", exchange -> {
            exchange.sendResponseHeaders(404, -1);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort());
        String content = client.getFileAtVersion("org/repo", "path/file.json", "abc1234");

        assertThat(content, is(nullValue()));
    }

    @Test
    void return_file_content_and_cache_it_on_a_200_response() throws Exception {
        when(cache.getContentAtSha(any(), any(), any())).thenReturn(Optional.empty());

        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/repos/org/repo/contents/path/file.json", exchange -> {
            byte[] body = "{\"milestones\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        GitHubFileHistoryClient client = clientFor("http://localhost:" + server.getAddress().getPort());
        String content = client.getFileAtVersion("org/repo", "path/file.json", "abc1234");

        assertThat(content, equalTo("{\"milestones\":[]}"));
        verify(cache).putContentAtSha("org/repo", "path/file.json", "abc1234", content);
    }

    @Test
    void return_null_when_content_fetch_throws() throws Exception {
        when(cache.getContentAtSha(any(), any(), any())).thenReturn(Optional.empty());

        // Bind a server purely to claim a free port, then stop it immediately -
        // nothing is listening there any more, so the request throws a connection
        // exception, exercising the catch (Exception e) path rather than the
        // non-200 branch above.
        server = HttpServer.create(new InetSocketAddress(0), 0);
        int freedPort = server.getAddress().getPort();
        server.stop(0);
        server = null;

        GitHubFileHistoryClient client = fastTimeoutClientFor("http://localhost:" + freedPort);
        String content = client.getFileAtVersion("org/repo", "path/file.json", "abc1234");

        assertThat(content, is(nullValue()));
    }
}
