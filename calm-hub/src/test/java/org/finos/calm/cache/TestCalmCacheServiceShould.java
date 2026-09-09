package org.finos.calm.cache;

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
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestCalmCacheServiceShould {

    private static final long MAX_SIZE = 10_000;

    private final FakeTicker ticker = new FakeTicker();
    private CalmCacheService cacheService;

    @BeforeEach
    void setup() {
        cacheService = new CalmCacheService(MAX_SIZE, ticker);
    }

    @Test
    void construct_via_the_config_property_constructor() {
        CalmCacheService service = new CalmCacheService(MAX_SIZE);
        service.put("key", "value", Duration.ofMinutes(1));
        assertThat(service.get("key", String.class).orElse(null), equalTo("value"));
    }

    @Test
    void return_empty_for_missing_key() {
        Optional<String> result = cacheService.get("nonexistent", String.class);
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    void store_and_retrieve_value() {
        cacheService.put("key1", "value1", Duration.ofMinutes(5));
        Optional<String> result = cacheService.get("key1", String.class);
        assertThat(result.isPresent(), is(true));
        assertThat(result.get(), equalTo("value1"));
    }

    @Test
    void store_and_retrieve_different_types() {
        cacheService.put("string-key", "hello", Duration.ofMinutes(5));
        cacheService.put("int-key", 42, Duration.ofMinutes(5));

        assertThat(cacheService.get("string-key", String.class).orElse(null), equalTo("hello"));
        assertThat(cacheService.get("int-key", Integer.class).orElse(null), equalTo(42));
    }

    @Test
    void return_empty_when_type_does_not_match() {
        cacheService.put("key", "string-value", Duration.ofMinutes(5));
        Optional<Integer> result = cacheService.get("key", Integer.class);
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    void store_and_retrieve_a_list() {
        cacheService.put("list-key", List.of("a", "b", "c"), Duration.ofMinutes(5));
        Optional<List<String>> result = cacheService.getList("list-key", String.class);
        assertThat(result.isPresent(), is(true));
        assertThat(result.get(), contains("a", "b", "c"));
    }

    @Test
    void return_empty_from_getList_for_missing_key() {
        assertThat(cacheService.getList("nonexistent", String.class).isEmpty(), is(true));
    }

    @Test
    void return_empty_from_getList_when_value_is_not_a_list() {
        cacheService.put("not-a-list", "just-a-string", Duration.ofMinutes(5));
        assertThat(cacheService.getList("not-a-list", String.class).isEmpty(), is(true));
    }

    @Test
    void return_empty_from_getList_when_an_element_type_does_not_match() {
        cacheService.put("mixed-list", List.of("a", 2, "c"), Duration.ofMinutes(5));
        assertThat(cacheService.getList("mixed-list", String.class).isEmpty(), is(true));
    }

    @Test
    void evict_single_key() {
        cacheService.put("key1", "value1", Duration.ofMinutes(5));
        cacheService.put("key2", "value2", Duration.ofMinutes(5));

        cacheService.evict("key1");

        assertThat(cacheService.get("key1", String.class).isEmpty(), is(true));
        assertThat(cacheService.get("key2", String.class).isPresent(), is(true));
    }

    @Test
    void evict_by_prefix() {
        cacheService.put("ns:finos:arch:1", "arch1", Duration.ofMinutes(5));
        cacheService.put("ns:finos:arch:2", "arch2", Duration.ofMinutes(5));
        cacheService.put("ns:finos:pattern:1", "pattern1", Duration.ofMinutes(5));
        cacheService.put("ns:other:arch:1", "other-arch1", Duration.ofMinutes(5));

        cacheService.evictByPrefix("ns:finos:arch:");

        assertThat(cacheService.get("ns:finos:arch:1", String.class).isEmpty(), is(true));
        assertThat(cacheService.get("ns:finos:arch:2", String.class).isEmpty(), is(true));
        assertThat(cacheService.get("ns:finos:pattern:1", String.class).isPresent(), is(true));
        assertThat(cacheService.get("ns:other:arch:1", String.class).isPresent(), is(true));
    }

    @Test
    void evict_by_prefix_when_no_keys_match() {
        cacheService.put("other:key", "value", Duration.ofMinutes(5));

        cacheService.evictByPrefix("nonexistent:");

        assertThat(cacheService.get("other:key", String.class).isPresent(), is(true));
    }

    @Test
    void expire_entries_after_ttl() {
        cacheService.put("short-lived", "value", Duration.ofMillis(50));
        assertThat(cacheService.get("short-lived", String.class).isPresent(), is(true));

        ticker.advance(Duration.ofMillis(100));

        assertThat(cacheService.get("short-lived", String.class).isEmpty(), is(true));
    }

    @Test
    void not_refresh_ttl_on_read() {
        cacheService.put("key", "value", Duration.ofMillis(50));
        ticker.advance(Duration.ofMillis(30));
        assertThat(cacheService.get("key", String.class).isPresent(), is(true));

        ticker.advance(Duration.ofMillis(30));

        assertThat(cacheService.get("key", String.class).isEmpty(), is(true));
    }

    @Test
    void overwrite_existing_key_with_new_value_and_ttl() {
        cacheService.put("key", "original", Duration.ofMinutes(5));
        cacheService.put("key", "updated", Duration.ofMinutes(10));

        Optional<String> result = cacheService.get("key", String.class);
        assertThat(result.isPresent(), is(true));
        assertThat(result.get(), equalTo("updated"));
    }

    @Test
    void handle_null_value_gracefully() {
        cacheService.put("null-key", null, Duration.ofMinutes(5));
        Optional<Object> result = cacheService.get("null-key", Object.class);
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    void reject_a_null_ttl() {
        assertThrows(NullPointerException.class, () -> cacheService.put("key", "value", null));
    }

    @Test
    void handle_concurrent_access_safely() throws Exception {
        int threadCount = 10;
        int iterationsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        List<Future<?>> futures = IntStream.range(0, threadCount)
                .<Future<?>>mapToObj(threadId -> executor.submit(() -> {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        String key = "thread-" + threadId + "-key-" + i;
                        cacheService.put(key, "value-" + i, Duration.ofMinutes(5));
                        cacheService.get(key, String.class);
                    }
                }))
                .toList();

        for (Future<?> future : futures) {
            future.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        for (int threadId = 0; threadId < threadCount; threadId++) {
            for (int i = 0; i < iterationsPerThread; i++) {
                String key = "thread-" + threadId + "-key-" + i;
                assertThat(cacheService.get(key, String.class).orElse(null), equalTo("value-" + i));
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
