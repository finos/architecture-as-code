package org.finos.calm.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import com.github.benmanes.caffeine.cache.Ticker;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentMap;

/**
 * A generic, in-memory TTL cache backed by Caffeine. It has no knowledge of
 * what it stores — namespace keys however you like (a `kind:id` prefix, as
 * used by {@link #evictByPrefix}) and choose a TTL per entry.
 *
 * <p>Each {@link #put} carries its own TTL rather than the cache having one
 * fixed lifetime, so a single instance can serve both short-lived and
 * effectively-permanent data — e.g. a 5-minute TTL for a version list next to
 * a 365-day TTL for immutable content addressed by commit SHA. That per-call
 * TTL is why this is a hand-rolled Caffeine cache rather than the
 * {@code quarkus-cache} extension: {@code @CacheResult} has one TTL per
 * annotated method, not per entry.
 *
 * <p>There is deliberately no interface here: this module puts an interface
 * in front of a service only where there are genuinely multiple backends
 * selected at runtime (see {@code store/} and its Mongo/Nitrite producers).
 * A cache abstraction has exactly one implementation today; if a second
 * (e.g. a distributed cache) is ever needed, extract an interface then.
 *
 * <p>Contract:
 * <ul>
 *   <li>{@link #get} and {@link #getList} return {@link Optional#empty()}
 *       both for a missing key and for a value that isn't an instance of the
 *       requested type — neither ever throws a {@link ClassCastException}.</li>
 *   <li>{@link #put} silently ignores a {@code null} value: nothing is
 *       stored, and any existing entry for the key is left untouched. A
 *       zero or negative {@code ttl} is accepted and expires the entry
 *       immediately.</li>
 *   <li>TTL is measured from the most recent {@link #put} for a key; it is
 *       <strong>not</strong> refreshed by {@link #get} or {@link #getList}
 *       — this is a TTL cache, not an LRU with sliding expiry.</li>
 * </ul>
 */
@ApplicationScoped
public class CalmCacheService {

    private final Cache<String, CacheEntry<?>> cache;

    @Inject
    public CalmCacheService(@ConfigProperty(name = "calm.cache.max-size", defaultValue = "10000") long maxSize) {
        this(maxSize, Ticker.systemTicker());
    }

    // Package-private: lets tests drive expiry deterministically with a fake Ticker
    // instead of Thread.sleep, the same pattern used by SchemaMigrationInProgressFilter's
    // injectable LongSupplier.
    CalmCacheService(long maxSize, Ticker ticker) {
        this.cache = Caffeine.newBuilder()
                .maximumSize(maxSize)
                .ticker(ticker)
                .expireAfter(new Expiry<String, CacheEntry<?>>() {
                    @Override
                    public long expireAfterCreate(String key, CacheEntry<?> value, long currentTime) {
                        return value.ttl().toNanos();
                    }

                    @Override
                    public long expireAfterUpdate(String key, CacheEntry<?> value, long currentTime, long currentDuration) {
                        return value.ttl().toNanos();
                    }

                    @Override
                    public long expireAfterRead(String key, CacheEntry<?> value, long currentTime, long currentDuration) {
                        return currentDuration;
                    }
                })
                .build();
    }

    /**
     * Reads a single cached value, validating it is an instance of {@code type}.
     *
     * @return the cached value, or empty if there is no entry for {@code key}
     *         or its value is not an instance of {@code type}
     */
    @SuppressWarnings("unchecked")
    public <T> Optional<T> get(String key, Class<T> type) {
        CacheEntry<?> entry = cache.getIfPresent(key);
        if (entry == null || !type.isInstance(entry.value())) {
            return Optional.empty();
        }
        return Optional.of((T) entry.value());
    }

    /**
     * Reads a cached {@link List}, validating every element is an instance of
     * {@code elementType}. {@link Class#isInstance} alone cannot express a
     * parameterized type such as {@code List<String>}, so this exists
     * alongside {@link #get} for list-valued entries — callers that need a
     * typed list should use this rather than {@code get(key, List.class)}
     * plus an unchecked cast.
     *
     * @return the cached list, or empty if there is no entry for {@code key},
     *         its value isn't a {@link List}, or any element isn't an
     *         instance of {@code elementType}
     */
    @SuppressWarnings("unchecked")
    public <E> Optional<List<E>> getList(String key, Class<E> elementType) {
        CacheEntry<?> entry = cache.getIfPresent(key);
        if (entry == null || !(entry.value() instanceof List<?> list)) {
            return Optional.empty();
        }
        for (Object element : list) {
            if (!elementType.isInstance(element)) {
                return Optional.empty();
            }
        }
        return Optional.of((List<E>) list);
    }

    /**
     * Stores {@code value} under {@code key} for {@code ttl}. A {@code null}
     * value is silently ignored — nothing is stored and any existing entry
     * for {@code key} is left as-is.
     */
    public void put(String key, Object value, Duration ttl) {
        Objects.requireNonNull(ttl, "ttl must not be null");
        if (value == null) {
            return;
        }
        cache.put(key, new CacheEntry<>(value, ttl));
    }

    /**
     * Removes a single cached entry. A no-op if {@code key} isn't cached.
     */
    public void evict(String key) {
        cache.invalidate(key);
    }

    /**
     * Removes every cached entry whose key starts with {@code prefix} — for
     * invalidating a family of related entries (e.g. everything cached for
     * one resource) without tracking each key individually.
     */
    public void evictByPrefix(String prefix) {
        ConcurrentMap<String, CacheEntry<?>> map = cache.asMap();
        map.keySet().removeIf(key -> key.startsWith(prefix));
    }

    record CacheEntry<T>(T value, Duration ttl) {}
}
