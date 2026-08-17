package org.finos.calm.cache;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

class TestCaffeineCacheServiceShould {

    private CaffeineCacheService cacheService;

    @BeforeEach
    void setup() {
        cacheService = new CaffeineCacheService();
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
    void expire_entries_after_ttl() throws InterruptedException {
        cacheService.put("short-lived", "value", Duration.ofMillis(50));

        assertThat(cacheService.get("short-lived", String.class).isPresent(), is(true));

        Thread.sleep(100);
        cacheService.put("trigger-cleanup", "x", Duration.ofMinutes(1));

        Optional<String> result = cacheService.get("short-lived", String.class);
        assertThat(result.isEmpty(), is(true));
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
    void handle_concurrent_access_safely() throws InterruptedException {
        int threadCount = 10;
        int iterationsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);

        for (int t = 0; t < threadCount; t++) {
            final int threadId = t;
            executor.submit(() -> {
                try {
                    for (int i = 0; i < iterationsPerThread; i++) {
                        String key = "thread-" + threadId + "-key-" + i;
                        cacheService.put(key, "value-" + i, Duration.ofMinutes(5));
                        cacheService.get(key, String.class);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(10, TimeUnit.SECONDS);
        executor.shutdown();
        assertThat(completed, is(true));
    }

    @Test
    void evict_by_prefix_when_no_keys_match() {
        cacheService.put("other:key", "value", Duration.ofMinutes(5));

        cacheService.evictByPrefix("nonexistent:");

        assertThat(cacheService.get("other:key", String.class).isPresent(), is(true));
    }

    @Test
    void handle_null_value_gracefully() {
        cacheService.put("null-key", null, Duration.ofMinutes(5));
        Optional<Object> result = cacheService.get("null-key", Object.class);
        assertThat(result.isEmpty(), is(true));
    }
}
