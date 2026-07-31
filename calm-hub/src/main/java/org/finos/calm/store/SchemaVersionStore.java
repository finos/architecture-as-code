package org.finos.calm.store;

/**
 * Tracks the schema/data-shape version currently applied to the active storage
 * backend (Mongo or Nitrite), so {@code org.finos.calm.migration.SchemaMigrationRunner}
 * can determine which outstanding changes still need to be applied.
 *
 * <p>Backed by the {@code calm} collection — distinct from the {@code schemas}
 * collection, which holds user-facing CALM meta-schema releases and is
 * unrelated to database schema versioning.</p>
 *
 * <p>Also provides a simple lock, held in the same collection, so that when
 * multiple CalmHub instances start up concurrently against the same shared
 * database (Mongo in particular), only one of them runs pending migration
 * steps at a time.</p>
 *
 * <p><b>The lock never expires automatically.</b> A migration may legitimately
 * run for a long time, or may fail partway and need investigation — in either
 * case, guessing a timeout risks a second instance running the same migration
 * concurrently with the first. Instead, a held lock is also used by
 * {@code org.finos.calm.migration.SchemaMigrationInProgressFilter} to make
 * every CalmHub instance (not just the one running the migration) refuse
 * requests until the lock clears. If a migration fails, the lock is
 * deliberately left held — an administrator must investigate and clear it
 * manually (e.g. by unsetting the {@code holder} field on the
 * {@code migrationLock} document) before the application resumes serving
 * requests.</p>
 */
public interface SchemaVersionStore {

    /**
     * Returns the schema version currently applied to this database, or
     * {@code 0} if no version has ever been recorded (a fresh database, or
     * one that predates schema-version tracking).
     */
    int getSchemaVersion();

    /**
     * Records {@code version} as the schema version now applied to this
     * database.
     */
    void setSchemaVersion(int version);

    /**
     * Attempts to acquire the schema-migration lock for {@code instanceId}.
     * Succeeds only if the lock is currently unheld. Returns {@code false} if
     * another instance already holds it — the lock never expires on its own.
     */
    boolean acquireMigrationLock(String instanceId);

    /**
     * Releases the schema-migration lock, but only if it is still held by
     * {@code instanceId} — a no-op otherwise, so a delayed/late release can
     * never clobber a lock a different instance has since acquired.
     */
    void releaseMigrationLock(String instanceId);

    /**
     * Returns {@code true} if the schema-migration lock is currently held by
     * any instance — used to gate request-serving while a migration is in
     * progress or has failed and is awaiting manual resolution.
     */
    boolean isMigrationLockHeld();
}
