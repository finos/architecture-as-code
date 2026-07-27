package org.finos.calm.migration;

import io.quarkus.arc.All;
import io.quarkus.runtime.LaunchMode;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.finos.calm.migration.steps.MongoIndexInitializationStep;
import org.finos.calm.store.SchemaVersionStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.LongConsumer;

/**
 * Runs outstanding {@link SchemaMigrationStep}s once at application startup, advancing
 * the version recorded in {@link SchemaVersionStore} one step at a time.
 *
 * <h2>Adding a new step</h2>
 * Implement {@link SchemaMigrationStep} as a CDI bean (see that interface's javadoc for
 * the visibility requirement) declaring the next unused {@link SchemaMigrationStep#fromVersion()}.
 * It's picked up automatically — nothing here needs to change. A version with no registered
 * step (e.g. {@link MongoIndexInitializationStep} in standalone mode, where it isn't even a CDI
 * bean) is treated as "not applicable" and the version advances anyway.
 *
 * <h2>Ordering and the latest version</h2>
 * All steps are collected via {@code @All List<SchemaMigrationStep>} and indexed by
 * {@link SchemaMigrationStep#fromVersion()}. Two steps declaring the same
 * {@code fromVersion()} is a fatal configuration error — construction fails fast rather
 * than silently running one and dropping the other. The highest {@code fromVersion() + 1}
 * across all registered steps is the version this runner will advance the schema to.
 *
 * <h2>Concurrent startup</h2>
 * Multiple CalmHub instances may start up at the same time against the same shared
 * database (Mongo in particular). {@link SchemaVersionStore#acquireMigrationLock} is
 * used to ensure only one instance runs pending steps; the others skip migration on
 * that startup and simply proceed. Acquisition is skipped entirely once the schema is
 * already at {@link #latestSchemaVersion}, so an already-migrated deployment (in
 * particular a pre-seeded read-only Nitrite image, whose database cannot be written to
 * at all) never attempts a write here.
 *
 * <h2>Lock visibility delay</h2>
 * {@link SchemaMigrationInProgressFilter} caches its "is the lock held?" check for
 * {@link SchemaMigrationInProgressFilter#CACHE_TTL} to avoid a store round-trip on every
 * request. That cache is per-instance, so right after acquiring the lock, any instance's
 * cache (including this one's) could still be serving a stale "not held" answer for up to
 * that TTL. To close that window, this runner waits {@link #LOCK_VISIBILITY_DELAY}
 * (deliberately longer than the cache TTL) after acquiring the lock before running any
 * actual migration step — guaranteeing every cache has expired and refreshed to "held"
 * by the time real work, and therefore real risk, begins.
 *
 * <h2>Failure behaviour — no automatic timeout, human resolution required</h2>
 * The lock never expires on its own (see {@link SchemaVersionStore}'s javadoc for why).
 * If a step throws, the run stops and — deliberately — the lock is <em>not</em> released:
 * the schema version is left at whatever it was before the failed step, and
 * {@link SchemaMigrationInProgressFilter} makes every CalmHub instance refuse requests
 * with 503 until an administrator investigates and manually clears the {@code holder}
 * field on the {@code migrationLock} document. The application itself is still allowed
 * to finish starting (it just won't serve traffic), so it remains inspectable (logs,
 * health/metrics endpoints not gated by the filter, etc.) while stuck.
 */
@ApplicationScoped
public class SchemaMigrationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(SchemaMigrationRunner.class);

    private static final Duration LOCK_VISIBILITY_MARGIN = Duration.ofSeconds(1);
    private static final Duration LOCK_VISIBILITY_DELAY =
            SchemaMigrationInProgressFilter.CACHE_TTL.plus(LOCK_VISIBILITY_MARGIN);

    private final SchemaVersionStore schemaVersionStore;
    private final Map<Integer, SchemaMigrationStep> stepsByFromVersion;
    private final int latestSchemaVersion;
    private final String instanceId = UUID.randomUUID().toString();
    private final LongConsumer sleeper;

    @Inject
    public SchemaMigrationRunner(SchemaVersionStore schemaVersionStore, @All List<SchemaMigrationStep> steps) {
        this(schemaVersionStore, steps, SchemaMigrationRunner::sleepUninterruptibly);
    }

    SchemaMigrationRunner(SchemaVersionStore schemaVersionStore, List<SchemaMigrationStep> steps, LongConsumer sleeper) {
        this.schemaVersionStore = schemaVersionStore;
        this.stepsByFromVersion = indexByFromVersion(steps);
        this.latestSchemaVersion = stepsByFromVersion.keySet().stream().mapToInt(Integer::intValue).max().orElse(-1) + 1;
        this.sleeper = sleeper;
    }

    private static Map<Integer, SchemaMigrationStep> indexByFromVersion(List<SchemaMigrationStep> steps) {
        Map<Integer, SchemaMigrationStep> byFromVersion = new HashMap<>();
        for (SchemaMigrationStep step : steps) {
            SchemaMigrationStep existing = byFromVersion.putIfAbsent(step.fromVersion(), step);
            if (existing != null) {
                throw new IllegalStateException("Duplicate SchemaMigrationStep for fromVersion "
                        + step.fromVersion() + ": " + existing.getClass().getName()
                        + " and " + step.getClass().getName());
            }
        }
        return byFromVersion;
    }

    private static void sleepUninterruptibly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOG.warn("Interrupted while waiting for the migration lock to become visible to all instances — proceeding anyway");
        }
    }

    void onStart(@Observes StartupEvent ev) {
        if (LaunchMode.current() == LaunchMode.TEST) {
            LOG.debug("Schema migration skipped in test mode");
            return;
        }
        if (schemaVersionStore.getSchemaVersion() >= latestSchemaVersion) {
            LOG.debug("Schema already at latest version {} — no migration lock needed", latestSchemaVersion);
            return;
        }
        if (!schemaVersionStore.acquireMigrationLock(instanceId)) {
            LOG.info("Schema migration lock held by another instance — skipping migration on this startup");
            return;
        }
        LOG.debug("Waiting {} for the migration lock to become visible to every instance's request cache",
                LOCK_VISIBILITY_DELAY);
        sleeper.accept(LOCK_VISIBILITY_DELAY.toMillis());
        if (runPendingMigrations()) {
            schemaVersionStore.releaseMigrationLock(instanceId);
        } else {
            LOG.error("Schema migration failed — leaving the migration lock held. This CalmHub instance "
                    + "(and any others sharing this database) will refuse requests until an administrator "
                    + "investigates and manually clears the migration lock.");
        }
    }

    /**
     * Runs every pending step in order. Returns {@code true} if the schema reached
     * {@link #latestSchemaVersion} (including trivially, if there was nothing to do),
     * {@code false} if a step threw and the run stopped early.
     */
    private boolean runPendingMigrations() {
        int version = schemaVersionStore.getSchemaVersion();
        while (version < latestSchemaVersion) {
            SchemaMigrationStep step = stepsByFromVersion.get(version);
            if (step == null) {
                LOG.info("No applicable schema migration step for version {} -> {} — skipping", version, version + 1);
            } else {
                LOG.info("Running schema migration step for version {} -> {}", version, version + 1);
                try {
                    step.apply();
                } catch (RuntimeException e) {
                    LOG.error("Schema migration step for version {} -> {} failed — leaving schema version at {}",
                            version, version + 1, version, e);
                    return false;
                }
            }
            version++;
            schemaVersionStore.setSchemaVersion(version);
        }
        return true;
    }
}
