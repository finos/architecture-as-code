package org.finos.calm.store.github.util;

import org.finos.calm.cache.CalmCacheService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.empty;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestGitHubVersionServiceShould {

    @Mock
    private CalmCacheService cache;

    private GitHubVersionService service;

    @BeforeEach
    void setup() {
        service = new GitHubVersionService();
        service.cache = cache;
        service.apiUrl = "https://api.github.com";
        service.serviceToken = Optional.of("test-token");
    }

    @Test
    void return_cached_versions_when_available() {
        List<String> cached = List.of("abc1234", "def5678");
        when(cache.get("versions:org/repo:path/file.json", List.class)).thenReturn(Optional.of(cached));

        List<String> result = service.getFileVersions("org/repo", "path/file.json");

        assertThat(result, equalTo(cached));
    }

    @Test
    void return_latest_when_api_fails() {
        when(cache.get(any(), eq(List.class))).thenReturn(Optional.empty());

        // API will fail since we're not running a real server
        List<String> result = service.getFileVersions("org/repo", "path/file.json");

        assertThat(result, hasSize(1));
        assertThat(result.get(0), equalTo("latest"));
    }

    @Test
    void return_latest_when_no_token() {
        service.serviceToken = Optional.empty();
        when(cache.get(any(), eq(List.class))).thenReturn(Optional.empty());

        List<String> result = service.getFileVersions("org/repo", "path/file.json");

        assertThat(result, hasSize(1));
        assertThat(result.get(0), equalTo("latest"));
    }

    @Test
    void extract_shas_from_github_api_response() {
        // Each SHA must be exactly 40 hex chars
        String sha1 = "abcdef1234567890abcdef1234567890abcdef12";
        String sha2 = "1234567890abcdef1234567890abcdef12345678";
        String json = "[{\"sha\":\"" + sha1 + "\",\"commit\":{}},{\"sha\":\"" + sha2 + "\",\"commit\":{}}]";

        List<String> shas = service.extractShas(json);

        assertThat(shas, hasSize(2));
        assertThat(shas.get(0), equalTo(sha1.substring(0, 7)));
        assertThat(shas.get(1), equalTo(sha2.substring(0, 7)));
    }

    @Test
    void return_empty_list_when_no_shas_in_response() {
        List<String> shas = service.extractShas("[]");

        assertThat(shas, is(empty()));
    }

    @Test
    void limit_to_10_shas() {
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < 15; i++) {
            if (i > 0) json.append(",");
            json.append(String.format("{\"sha\":\"%040x\"}", i));
        }
        json.append("]");

        List<String> shas = service.extractShas(json.toString());

        assertThat(shas, hasSize(10));
    }
}
