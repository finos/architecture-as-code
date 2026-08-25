package org.finos.calm.migration;

/**
 * A single unit of work that upgrades the active storage backend from one schema
 * version to the next, run once by {@link SchemaMigrationRunner}.
 *
 * <p>Implementations should be idempotent where practical (safe to re-run if a
 * previous attempt applied partially), since a failed step leaves the schema
 * version unchanged and will be retried on the next application startup.</p>
 *
 * <p>Every implementation must be a CDI bean visible as this interface (no
 * {@code @Typed} restriction to a narrower type) so {@link SchemaMigrationRunner}
 * can discover it via {@code @All List<SchemaMigrationStep>}. A step gated by
 * {@code @LookupIfProperty} (e.g. Mongo-only) simply doesn't exist as a bean when
 * its condition doesn't hold, so it's naturally absent from that list — the
 * runner treats a version with no registered step as "not applicable" and
 * advances anyway.</p>
 */
public interface SchemaMigrationStep {

    /**
     * The schema version this step upgrades the database from. {@link SchemaMigrationRunner}
     * runs this step when the current schema version equals this value, then advances the
     * version to {@code fromVersion() + 1}.
     *
     * <p>Must be unique across all registered steps — two steps declaring the same
     * {@code fromVersion()} is a fatal configuration error, detected at startup.</p>
     */
    int fromVersion();

    /**
     * Applies this step's migration/initialization logic. Throwing stops the
     * migration run for this startup — the schema version is not advanced past
     * this step, so it will be retried next startup.
     */
    void apply();
}
