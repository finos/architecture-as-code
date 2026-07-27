package org.finos.calm.migration;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.finos.calm.store.SchemaVersionStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.LongSupplier;

/**
 * Rejects every request with {@code 503 Service Unavailable} while the schema-migration
 * lock ({@link SchemaVersionStore#isMigrationLockHeld()}) is held.
 *
 * <p>The lock is held for as long as {@link SchemaMigrationRunner} is actively applying
 * steps, however long that takes — and, if a step fails, deliberately left held
 * afterwards pending manual resolution (see that class's javadoc). This filter is what
 * makes that visible to callers, and makes it apply uniformly to every CalmHub instance
 * sharing the database, not just the one that happened to run the migration.</p>
 *
 * <p>Runs {@code @PreMatching} at a priority before {@code ReadOnlyRequestFilter} (0), so
 * "migration in progress" always takes precedence over every other rejection reason.</p>
 *
 * <h2>Caching</h2>
 * Checking the lock is a real store read (a network round-trip in Mongo mode), and this
 * filter runs on every single request, so the result is cached for {@link #CACHE_TTL}
 * rather than re-checked every time. {@link SchemaMigrationRunner} deliberately waits
 * longer than {@link #CACHE_TTL} after acquiring the lock before running any actual
 * migration step, which guarantees every instance's cache (including this one's) has
 * expired and been refreshed to "held" before real work starts — see that class's
 * javadoc for the full argument. Elapsed time for the TTL is measured with
 * {@link System#nanoTime()}, not wall-clock time, so an NTP correction or manual clock
 * change can't make a stale cache entry look artificially fresh.
 *
 * <h2>Store failures</h2>
 * If the store read itself fails (e.g. a transient MongoDB blip), this filter fails open —
 * logs a warning and lets the request through — rather than letting the exception escape
 * uncaught (no {@code ExceptionMapper} exists in this codebase for a bare store exception,
 * so it would otherwise surface as a raw 500 on every request for the outage's duration,
 * worse than the graceful 503 this filter exists to provide). The failure isn't cached, so
 * the very next request retries the store rather than being stuck on a guessed answer for
 * the TTL.
 */
@ApplicationScoped
@Provider
@PreMatching
@Priority(-100)
public class SchemaMigrationInProgressFilter implements ContainerRequestFilter {

    private static final Logger LOG = LoggerFactory.getLogger(SchemaMigrationInProgressFilter.class);

    static final Duration CACHE_TTL = Duration.ofSeconds(2);

    private final SchemaVersionStore schemaVersionStore;
    private final LongSupplier elapsedTimeNanosSource;
    private final AtomicReference<CacheEntry> cache = new AtomicReference<>();

    @Inject
    public SchemaMigrationInProgressFilter(SchemaVersionStore schemaVersionStore) {
        this(schemaVersionStore, System::nanoTime);
    }

    SchemaMigrationInProgressFilter(SchemaVersionStore schemaVersionStore, LongSupplier elapsedTimeNanosSource) {
        this.schemaVersionStore = schemaVersionStore;
        this.elapsedTimeNanosSource = elapsedTimeNanosSource;
    }

    @Override
    public void filter(ContainerRequestContext requestContext) {
        if (!isMigrationLockHeld()) {
            return;
        }
        LOG.warn("Rejecting {} {} — schema migration in progress or awaiting manual resolution",
                requestContext.getMethod(), requestContext.getUriInfo().getPath());
        requestContext.abortWith(
                Response.status(Response.Status.SERVICE_UNAVAILABLE)
                        .entity("CalmHub is applying a schema migration and cannot serve requests right now. "
                                + "If this persists, an administrator must investigate and clear the migration lock.")
                        .build());
    }

    private boolean isMigrationLockHeld() {
        long now = elapsedTimeNanosSource.getAsLong();
        CacheEntry current = cache.get();
        if (current != null && now - current.checkedAtNanos() <= CACHE_TTL.toNanos()) {
            return current.held();
        }
        boolean held;
        try {
            held = schemaVersionStore.isMigrationLockHeld();
        } catch (RuntimeException e) {
            LOG.warn("Failed to check the schema migration lock — allowing the request through", e);
            return false;
        }
        cache.set(new CacheEntry(held, now));
        return held;
    }

    private record CacheEntry(boolean held, long checkedAtNanos) {
    }
}
