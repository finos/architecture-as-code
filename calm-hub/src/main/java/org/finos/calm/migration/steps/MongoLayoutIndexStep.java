package org.finos.calm.migration.steps;

import com.mongodb.MongoCommandException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Creates the unique index the flat layout storage shape needs: one document per
 * {@code (namespace, architectureId)} rather than one document per namespace.
 *
 * <h2>Why this is a migration step and not just a corrected line in {@code MongoIndexInitializationStep}</h2>
 * An earlier, unshipped revision of this branch added {@code layouts} to
 * {@code MongoIndexInitializationStep}'s namespace-only unique-index loop — the wrong index for
 * this shape, since {@code {namespace: 1}} unique permits only one layout document per
 * namespace. Simply correcting that line is not enough: {@code MongoIndexInitializationStep}
 * runs at {@code fromVersion() == 0}, and any deployment already past schema version 0 never
 * re-runs it. Those deployments would start writing layouts with no index at all. A new step at
 * {@link #fromVersion()} {@code == 9} reaches them the same way every other post-launch schema
 * change does.
 *
 * <h2>Why this needs no data migration</h2>
 * Unlike {@link MongoVersionSplitMigration}, there is no fan-out here. The layout feature has
 * never shipped past this branch, so there is no old-shape {@code layouts} data anywhere to
 * move — this step only ever needs to establish the index.
 *
 * <h2>The stale-index drop</h2>
 * {@link #createIndexes()} tolerantly drops {@code layouts.namespace_1} (MongoDB's default name
 * for the index the unshipped revision above briefly created), ignoring
 * {@code IndexNotFound} (code 27). This exists for index *state*, not data: the only databases
 * that could hold that index are developer machines that ran an intermediate revision of this
 * branch against a from-empty database. Without the drop, such a database would silently keep
 * an index that makes a second architecture's layout in the same namespace collide.
 *
 * <h2>Mongo-only</h2>
 * Schema version 9 → 10 is Mongo-only. Nitrite creates no indexes at all (see
 * {@code NitriteVersionSplitMigration}'s javadoc), so there is no Nitrite twin at this
 * {@code fromVersion()}. That does not mean a Nitrite step could never share {@code == 9}:
 * Mongo and Nitrite steps are mutually exclusive {@code @LookupIfProperty} beans, so
 * {@code SchemaMigrationRunner}'s duplicate-{@code fromVersion} guard never sees both at once.
 * The real hazard is the other direction — a Nitrite deployment has no step at {@code == 9} to
 * run, so it advances past it as a no-op. A Nitrite step added later at {@code fromVersion() == 9}
 * would never run against a Nitrite database that had already reached schema version 10 by then.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoLayoutIndexStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoLayoutIndexStep.class);

    private static final String COLLECTION = "layouts";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ARCHITECTURE_ID_FIELD = "architectureId";

    /** The index an unshipped revision of {@code MongoIndexInitializationStep} briefly created. */
    private static final String STALE_NAMESPACE_INDEX = "namespace_1";

    /** MongoDB's {@code IndexNotFound} error code. */
    private static final int INDEX_NOT_FOUND = 27;

    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoLayoutIndexStep(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 9;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping layout index creation (database mode: {})", databaseMode);
            return;
        }
        createIndexes();
    }

    /**
     * Creates the index unconditionally — no {@code databaseMode} check. Public, like
     * {@code MongoIndexInitializationStep#createIndexes()}, specifically so integration-test
     * infrastructure with a known-real MongoDB container can call it directly.
     */
    public void createIndexes() {
        MongoCollection<Document> layouts = database.getCollection(COLLECTION);
        dropStaleNamespaceIndex(layouts);

        layouts.createIndex(new Document(NAMESPACE_FIELD, 1).append(ARCHITECTURE_ID_FIELD, 1),
                new IndexOptions().unique(true));
        LOG.info("Ensured unique index on {}.({}, {})", COLLECTION, NAMESPACE_FIELD, ARCHITECTURE_ID_FIELD);
    }

    private void dropStaleNamespaceIndex(MongoCollection<Document> layouts) {
        try {
            layouts.dropIndex(STALE_NAMESPACE_INDEX);
            LOG.info("Dropped the stale unique index {}.{}", COLLECTION, STALE_NAMESPACE_INDEX);
        } catch (MongoCommandException e) {
            if (e.getErrorCode() != INDEX_NOT_FOUND) {
                throw e;
            }
            LOG.info("No stale {}.{} index to drop", COLLECTION, STALE_NAMESPACE_INDEX);
        }
    }
}
