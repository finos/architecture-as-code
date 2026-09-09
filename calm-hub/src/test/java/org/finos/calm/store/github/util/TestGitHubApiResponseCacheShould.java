package org.finos.calm.store.github.util;

import com.github.benmanes.caffeine.cache.Ticker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

class TestGitHubApiResponseCacheShould {

    private static final long MAX_SIZE = 10_000;

    private final FakeTicker ticker = new FakeTicker();
    private GitHubApiResponseCache cache;

    @BeforeEach
    void setup() {
        cache = new GitHubApiResponseCache(MAX_SIZE, ticker);
    }

    @Test
    void construct_via_the_config_property_constructor() {
        GitHubApiResponseCache service = new GitHubApiResponseCache(MAX_SIZE);
        service.putVersions("org/repo", "path/file.json", List.of("abc1234"));
        assertThat(service.getVersions("org/repo", "path/file.json").orElse(null), contains("abc1234"));
    }

    @Test
    void return_empty_versions_for_a_missing_key() {
        assertThat(cache.getVersions("org/repo", "path/file.json").isEmpty(), is(true));
    }

    @Test
    void store_and_retrieve_versions() {
        cache.putVersions("org/repo", "path/file.json", List.of("abc1234", "def5678"));

        Optional<List<String>> result = cache.getVersions("org/repo", "path/file.json");

        assertThat(result.isPresent(), is(true));
        assertThat(result.get(), contains("abc1234", "def5678"));
    }

    @Test
    void keep_versions_for_different_files_independent() {
        cache.putVersions("org/repo", "path/a.json", List.of("aaa"));
        cache.putVersions("org/repo", "path/b.json", List.of("bbb"));

        assertThat(cache.getVersions("org/repo", "path/a.json").orElse(null), contains("aaa"));
        assertThat(cache.getVersions("org/repo", "path/b.json").orElse(null), contains("bbb"));
    }

    @Test
    void overwrite_existing_versions_entry() {
        cache.putVersions("org/repo", "path/file.json", List.of("old"));
        cache.putVersions("org/repo", "path/file.json", List.of("new"));

        assertThat(cache.getVersions("org/repo", "path/file.json").orElse(null), contains("new"));
    }

    @Test
    void ignore_a_null_versions_value() {
        cache.putVersions("org/repo", "path/file.json", null);
        assertThat(cache.getVersions("org/repo", "path/file.json").isEmpty(), is(true));
    }

    @Test
    void expire_versions_after_five_minutes() {
        cache.putVersions("org/repo", "path/file.json", List.of("abc1234"));
        assertThat(cache.getVersions("org/repo", "path/file.json").isPresent(), is(true));

        ticker.advance(Duration.ofMinutes(5).plusSeconds(1));

        assertThat(cache.getVersions("org/repo", "path/file.json").isEmpty(), is(true));
    }

    @Test
    void not_refresh_versions_ttl_on_read() {
        cache.putVersions("org/repo", "path/file.json", List.of("abc1234"));
        ticker.advance(Duration.ofMinutes(3));
        assertThat(cache.getVersions("org/repo", "path/file.json").isPresent(), is(true));

        ticker.advance(Duration.ofMinutes(3));

        assertThat(cache.getVersions("org/repo", "path/file.json").isEmpty(), is(true));
    }

    @Test
    void return_empty_content_for_a_missing_key() {
        assertThat(cache.getContentAtSha("org/repo", "path/file.json", "abc1234").isEmpty(), is(true));
    }

    @Test
    void store_and_retrieve_content_at_sha() {
        cache.putContentAtSha("org/repo", "path/file.json", "abc1234", "file contents");

        Optional<String> result = cache.getContentAtSha("org/repo", "path/file.json", "abc1234");

        assertThat(result.isPresent(), is(true));
        assertThat(result.get(), equalTo("file contents"));
    }

    @Test
    void keep_content_for_different_shas_independent() {
        cache.putContentAtSha("org/repo", "path/file.json", "sha1", "content-at-sha1");
        cache.putContentAtSha("org/repo", "path/file.json", "sha2", "content-at-sha2");

        assertThat(cache.getContentAtSha("org/repo", "path/file.json", "sha1").orElse(null), equalTo("content-at-sha1"));
        assertThat(cache.getContentAtSha("org/repo", "path/file.json", "sha2").orElse(null), equalTo("content-at-sha2"));
    }

    @Test
    void ignore_a_null_content_value() {
        cache.putContentAtSha("org/repo", "path/file.json", "abc1234", null);
        assertThat(cache.getContentAtSha("org/repo", "path/file.json", "abc1234").isEmpty(), is(true));
    }

    @Test
    void expire_content_after_365_days() {
        cache.putContentAtSha("org/repo", "path/file.json", "abc1234", "file contents");
        assertThat(cache.getContentAtSha("org/repo", "path/file.json", "abc1234").isPresent(), is(true));

        ticker.advance(Duration.ofDays(365).plusSeconds(1));

        assertThat(cache.getContentAtSha("org/repo", "path/file.json", "abc1234").isEmpty(), is(true));
    }

    @Test
    void expire_versions_and_content_independently_of_each_other() {
        cache.putVersions("org/repo", "path/file.json", List.of("abc1234"));
        cache.putContentAtSha("org/repo", "path/file.json", "abc1234", "file contents");

        ticker.advance(Duration.ofMinutes(5).plusSeconds(1));

        assertThat(cache.getVersions("org/repo", "path/file.json").isEmpty(), is(true));
        assertThat(cache.getContentAtSha("org/repo", "path/file.json", "abc1234").isPresent(), is(true));
    }

    @Test
    void handle_concurrent_access_safely() throws Exception {
        int threadCount = 10;
        int iterationsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        List<Future<?>> futures = IntStream.range(0, threadCount)
                .<Future<?>>mapToObj(threadId -> executor.submit(() -> {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        String filePath = "path/" + threadId + "/" + i + ".json";
                        cache.putVersions("org/repo", filePath, List.of("sha-" + i));
                        cache.getVersions("org/repo", filePath);
                    }
                }))
                .toList();

        for (Future<?> future : futures) {
            future.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        for (int threadId = 0; threadId < threadCount; threadId++) {
            for (int i = 0; i < iterationsPerThread; i++) {
                String filePath = "path/" + threadId + "/" + i + ".json";
                assertThat(cache.getVersions("org/repo", filePath).orElse(null), contains("sha-" + i));
            }
        }
    }

    /**
     * A manually-advanced {@link Ticker} so expiry tests are deterministic
     * instead of relying on {@code Thread.sleep}.
     */
    private static final class FakeTicker implements Ticker {
        private long nanos = 0;

        @Override
        public long read() {
            return nanos;
        }

        void advance(Duration duration) {
            nanos += duration.toNanos();
        }
    }
}
