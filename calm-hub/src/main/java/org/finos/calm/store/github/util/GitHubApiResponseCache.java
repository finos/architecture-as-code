package org.finos.calm.store.github.util;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * Caches responses from the GitHub REST API on behalf of {@code GitHubVersionService}:
 * version lists for a file (5 minutes) and file content at an immutable commit SHA
 * (365 days).
 *
 * <p>This is a per-JVM, in-memory Caffeine cache with no cross-instance coordination
 * and no invalidation broadcast — in a multi-instance deployment, each calm-hub
 * instance holds its own independent copy and instances can disagree with each other
 * for up to a TTL window. That is safe here, structurally, for two reasons:
 * <ul>
 *   <li>The GitHub backend is read-only through calm-hub — every create/update/delete
 *       on {@code GitHubArchitectureStore} and its siblings throws
 *       {@code GitHubWriteNotSupportedException}, so nothing calm-hub does can ever
 *       invalidate an entry that needs invalidating.</li>
 *   <li>The GitHub backend already tolerates per-instance eventual consistency by
 *       design: {@code GitHubSyncScheduler} runs an unguarded, independent sync per
 *       instance (no leader election) on a roughly 60-second interval, each instance
 *       maintaining its own local clone and its own in-memory registry snapshot.
 *       Instances already legitimately disagree for up to that window before this
 *       cache is even in the picture.</li>
 * </ul>
 *
 * <p><strong>Do not reuse this pattern for Mongo/Nitrite-backed data.</strong> That
 * backend is the primary one and supports full CRUD through the REST API — a Mongo
 * write on one instance would never invalidate another instance's cached read there,
 * which is a real correctness problem, not a benign staleness window. This class's API
 * is deliberately GitHub-shaped (no generic key/type/TTL parameters) specifically so it
 * can't be reached for as a general-purpose cache; see
 * <a href="https://github.com/finos/architecture-as-code/issues/3073">#3073</a> for the
 * fuller discussion.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubApiResponseCache {

    private static final Duration VERSIONS_TTL = Duration.ofMinutes(5);
    private static final Duration CONTENT_TTL = Duration.ofDays(365);

    private final Cache<String, List<String>> versionsCache;
    private final Cache<String, String> contentCache;

    @Inject
    public GitHubApiResponseCache(@ConfigProperty(name = "calm.github.cache.max-size", defaultValue = "10000") long maxSize) {
        this(maxSize, Ticker.systemTicker());
    }

    // Package-private: lets tests drive expiry deterministically with a fake Ticker
    // instead of Thread.sleep, the same pattern used by SchemaMigrationInProgressFilter's
    // injectable LongSupplier.
    GitHubApiResponseCache(long maxSize, Ticker ticker) {
        this.versionsCache = Caffeine.newBuilder()
                .maximumSize(maxSize)
                .ticker(ticker)
                .expireAfterWrite(VERSIONS_TTL)
                .build();
        this.contentCache = Caffeine.newBuilder()
                .maximumSize(maxSize)
                .ticker(ticker)
                .expireAfterWrite(CONTENT_TTL)
                .build();
    }

    /**
     * Reads the cached commit-SHA version list for a file, if present and not
     * expired.
     */
    public Optional<List<String>> getVersions(String repoFullName, String filePath) {
        return Optional.ofNullable(versionsCache.getIfPresent(versionsKey(repoFullName, filePath)));
    }

    /**
     * Caches the commit-SHA version list for a file for {@link #VERSIONS_TTL}. A
     * {@code null} list is silently ignored.
     */
    public void putVersions(String repoFullName, String filePath, List<String> versions) {
        if (versions == null) {
            return;
        }
        versionsCache.put(versionsKey(repoFullName, filePath), versions);
    }

    /**
     * Reads the cached file content at a commit SHA, if present and not expired.
     */
    public Optional<String> getContentAtSha(String repoFullName, String filePath, String sha) {
        return Optional.ofNullable(contentCache.getIfPresent(contentKey(repoFullName, filePath, sha)));
    }

    /**
     * Caches file content at a commit SHA for {@link #CONTENT_TTL}. A {@code null}
     * content value is silently ignored. Safe to cache for a long TTL because a
     * commit SHA is immutable — the same SHA always resolves to the same content.
     */
    public void putContentAtSha(String repoFullName, String filePath, String sha, String content) {
        if (content == null) {
            return;
        }
        contentCache.put(contentKey(repoFullName, filePath, sha), content);
    }

    private static String versionsKey(String repoFullName, String filePath) {
        return "versions:" + repoFullName + ":" + filePath;
    }

    private static String contentKey(String repoFullName, String filePath, String sha) {
        return "content:" + repoFullName + ":" + filePath + ":" + sha;
    }
}
