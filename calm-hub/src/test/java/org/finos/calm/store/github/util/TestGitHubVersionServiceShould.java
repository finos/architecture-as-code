package org.finos.calm.store.github.util;

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
import java.net.http.HttpHeaders;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestGitHubVersionServiceShould {

    @Mock
    private GitHubApiResponseCache cache;

    private GitHubVersionService service;

    private GitHubStoreConfig storeConfig;

    private HttpServer server;

    @BeforeEach
    void setup() {
        service = new GitHubVersionService();
        service.cache = cache;
        storeConfig = new GitHubStoreConfig("test-token", "/tmp/calm-hub-clones", "https://api.github.com");
        service.storeConfig = storeConfig;
        service.maxVersions = 100;
        service.connectTimeoutSeconds = 10;
        service.requestTimeoutSeconds = 30;
        service.init();
    }

    @AfterEach
    void teardown() {
        if (server != null) {
            server.stop(0);
        }
    }

    private void setApiUrl(String apiUrl) {
        storeConfig = new GitHubStoreConfig(storeConfig.getServiceToken(), storeConfig.getCloneDirectory().toString(), apiUrl);
        service.storeConfig = storeConfig;
    }

    private void setServiceToken(String serviceToken) {
        storeConfig = new GitHubStoreConfig(serviceToken, storeConfig.getCloneDirectory().toString(), storeConfig.getApiUrl());
        service.storeConfig = storeConfig;
    }

    @Test
    void return_cached_versions_when_available() {
        List<String> cached = List.of("abc1234", "def5678");
        when(cache.getVersions("org/repo", "main", "path/file.json")).thenReturn(Optional.of(cached));

        List<String> result = service.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, equalTo(cached));
    }

    @Test
    void return_latest_when_api_fails() {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        // API will fail since we're not running a real server
        List<String> result = service.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, hasSize(1));
        assertThat(result.get(0), equalTo("latest"));
    }

    @Test
    void return_latest_when_no_token() {
        setServiceToken("");
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        List<String> result = service.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, hasSize(1));
        assertThat(result.get(0), equalTo("latest"));
    }

    @Test
    void extract_abbreviated_7_char_shas_from_github_api_response() {
        String sha1 = "abcdef1234567890abcdef1234567890abcdef12";
        String sha2 = "1234567890abcdef1234567890abcdef12345678";
        String json = "[{\"sha\":\"" + sha1 + "\",\"commit\":{}},{\"sha\":\"" + sha2 + "\",\"commit\":{}}]";

        List<String> shas = service.extractShas(json, 100);

        assertThat(shas, hasSize(2));
        assertThat(shas.get(0), equalTo("abcdef1"));
        assertThat(shas.get(1), equalTo("1234567"));
    }

    @Test
    void return_empty_list_when_no_shas_in_response() {
        List<String> shas = service.extractShas("[]", 100);

        assertThat(shas, is(empty()));
    }

    @Test
    void return_empty_list_for_malformed_json() {
        List<String> shas = service.extractShas("not valid json", 100);

        assertThat(shas, is(empty()));
    }

    @Test
    void return_null_from_extract_next_link_when_no_link_header_present() {
        HttpHeaders headers = HttpHeaders.of(Map.of(), (a, b) -> true);

        assertThat(service.extractNextLink(headers), is(nullValue()));
    }

    @Test
    void extract_the_next_link_url_from_a_link_header() {
        HttpHeaders headers = HttpHeaders.of(
                Map.of("Link", List.of("<https://api.github.com/repos/org/repo/commits?page=2>; rel=\"next\"")),
                (a, b) -> true);

        assertThat(service.extractNextLink(headers), equalTo("https://api.github.com/repos/org/repo/commits?page=2"));
    }

    @Test
    void limit_to_configured_max_versions() {
        service.maxVersions = 5;
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < 15; i++) {
            if (i > 0) json.append(",");
            json.append(String.format("{\"sha\":\"%040x\"}", i));
        }
        json.append("]");

        List<String> shas = service.extractShas(json.toString(), 5);

        assertThat(shas, hasSize(5));
    }

    @Test
    void return_cached_content_at_sha_when_available() {
        when(cache.getContentAtSha("org/repo", "path/file.json", "abc1234"))
                .thenReturn(Optional.of("{\"cached\":true}"));

        String content = service.getFileAtVersion("org/repo", "path/file.json", "abc1234");

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
        setApiUrl("http://localhost:" + server.getAddress().getPort());

        String content = service.getFileAtVersion("org/repo", "path/file.json", "abc1234");

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
        setApiUrl("http://localhost:" + server.getAddress().getPort());

        String content = service.getFileAtVersion("org/repo", "path/file.json", "abc1234");

        assertThat(content, equalTo("{\"milestones\":[]}"));
        org.mockito.Mockito.verify(cache).putContentAtSha("org/repo", "path/file.json", "abc1234", content);
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
        setApiUrl("http://localhost:" + freedPort);
        // A closed local port can hang until the connect/request timeout rather than
        // refusing instantly - keep this test fast rather than waiting out the
        // production 10s/30s defaults set up in @BeforeEach.
        service.connectTimeoutSeconds = 1;
        service.requestTimeoutSeconds = 1;
        service.init();

        String content = service.getFileAtVersion("org/repo", "path/file.json", "abc1234");

        assertThat(content, is(nullValue()));
    }

    @Test
    void return_latest_when_the_commits_request_connection_fails() throws Exception {
        when(cache.getVersions(any(), any(), any())).thenReturn(Optional.empty());

        server = HttpServer.create(new InetSocketAddress(0), 0);
        int freedPort = server.getAddress().getPort();
        server.stop(0);
        server = null;
        setApiUrl("http://localhost:" + freedPort);
        service.connectTimeoutSeconds = 1;
        service.requestTimeoutSeconds = 1;
        service.init();

        List<String> result = service.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(result, hasSize(1));
        assertThat(result.get(0), equalTo("latest"));
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
        setApiUrl("http://localhost:" + server.getAddress().getPort());

        List<String> result = service.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(callCount.get(), equalTo(2));
        assertThat(result, contains("2222222", "1111111"));
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
        setApiUrl("http://localhost:" + server.getAddress().getPort());

        List<String> result = service.getFileVersions("org/repo", "main", "path/file.json");

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
        setApiUrl("http://localhost:" + server.getAddress().getPort());

        List<String> result = service.getFileVersions("org/repo", "main", "path/file.json");

        assertThat(callCount.get(), equalTo(1));
        assertThat(result, contains("1111111"));
    }
}
