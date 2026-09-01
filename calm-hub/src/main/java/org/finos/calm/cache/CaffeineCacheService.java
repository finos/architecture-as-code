package org.finos.calm.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@ApplicationScoped
public class CaffeineCacheService implements CalmCacheService {

    private final Cache<String, CacheEntry<?>> cache;

    public CaffeineCacheService() {
        this.cache = Caffeine.newBuilder()
                .maximumSize(10_000)
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

    @Override
    @SuppressWarnings("unchecked")
    public <T> Optional<T> get(String key, Class<T> type) {
        CacheEntry<?> entry = cache.getIfPresent(key);
        if (entry == null) {
            return Optional.empty();
        }
        if (!type.isInstance(entry.value())) {
            return Optional.empty();
        }
        return Optional.of((T) entry.value());
    }

    @Override
    public <T> void put(String key, T value, Duration ttl) {
        if (value == null) {
            return;
        }
        cache.put(key, new CacheEntry<>(value, ttl));
    }

    @Override
    public void evict(String key) {
        cache.invalidate(key);
    }

    @Override
    public void evictByPrefix(String prefix) {
        ConcurrentMap<String, CacheEntry<?>> map = cache.asMap();
        map.keySet().removeIf(key -> key.startsWith(prefix));
    }

    record CacheEntry<T>(T value, Duration ttl) {}
}
