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
 * Widens the {@code resource_mappings} unique index from {@code (namespace, customId)} to
 * {@code (namespace, resourceType, customId)}, so the same customId can be reused across
 * different resource types (e.g. a pattern and an architecture can both be named {@code "repo"}).
 *
 * <h2>Why this is a migration step and not a corrected line in {@code MongoIndexInitializationStep}</h2>
 * Already-merged migration steps must keep working unchanged, in sequence, whether replayed
 * against an empty CalmHub or applied on top of a fully up-to-date one — so
 * {@code MongoIndexInitializationStep}, which runs once at {@code fromVersion() == 0}, is never
 * edited after the fact. That means this step is the only place the 3-field unique index is
 * established, for a fresh database and an existing deployment alike: a fresh database creates
 * the old 2-field index at version 0 like it always has, and this step (at
 * {@link #fromVersion()} {@code == 11}) then widens it, the same way every other post-launch
 * schema change reaches both new and existing deployments. See {@link MongoLayoutIndexStep} for
 * the precedent this follows.
 *
 * <h2>Why this needs no data migration</h2>
 * {@code resourceType} is present on every {@code resource_mappings} document already — the
 * document readers ({@code MongoResourceMappingStore#documentToMapping}) call
 * {@code ResourceType.valueOf(...)} on it unguarded, so a missing value would already throw
 * today. Widening a unique index from a tighter key to a looser one (adding a field) can never
 * fail on pre-existing data: every document that satisfied uniqueness under the old key still
 * satisfies it under the new, strictly-more-specific key. No backfill pass is required.
 *
 * <h2>The stale-index drop</h2>
 * {@link #createIndexes()} tolerantly drops {@code resource_mappings.namespace_1_customId_1}
 * (MongoDB's default name for the index {@link MongoIndexInitializationStep} created at schema
 * version 0), ignoring {@code IndexNotFound} (code 27), before creating the replacement. Without
 * the drop, the old narrower unique index would remain in place alongside the new one and would
 * still reject a cross-type customId reuse.
 *
 * <h2>Mongo-only</h2>
 * NitriteDB creates no indexes — its uniqueness check is enforced at the application level in
 * {@code NitriteResourceMappingStore#createMapping}, which already includes {@code resourceType}
 * in its duplicate-detection filter. There is no Nitrite twin at this {@code fromVersion()}.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoResourceMappingIndexStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoResourceMappingIndexStep.class);

    private static final String COLLECTION = "resource_mappings";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String RESOURCE_TYPE_FIELD = "resourceType";
    private static final String CUSTOM_ID_FIELD = "customId";

    /** MongoDB's default name for the {@code (namespace, customId)} index created at schema version 0. */
    private static final String STALE_NAMESPACE_CUSTOM_ID_INDEX = "namespace_1_customId_1";

    /** MongoDB's {@code IndexNotFound} error code. */
    private static final int INDEX_NOT_FOUND = 27;

    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoResourceMappingIndexStep(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 11;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping resource_mappings index migration (database mode: {})", databaseMode);
            return;
        }
        createIndexes();
    }

    /**
     * Creates the index unconditionally — no {@code databaseMode} check. Public, like
     * {@code MongoIndexInitializationStep#createIndexes()} and {@code MongoLayoutIndexStep#createIndexes()},
     * specifically so integration-test infrastructure with a known-real MongoDB container can
     * call it directly.
     */
    public void createIndexes() {
        MongoCollection<Document> mappings = database.getCollection(COLLECTION);
        dropStaleNamespaceCustomIdIndex(mappings);

        mappings.createIndex(new Document(NAMESPACE_FIELD, 1).append(RESOURCE_TYPE_FIELD, 1).append(CUSTOM_ID_FIELD, 1),
                new IndexOptions().unique(true));
        LOG.info("Ensured unique index on {}.({}, {}, {})", COLLECTION, NAMESPACE_FIELD, RESOURCE_TYPE_FIELD, CUSTOM_ID_FIELD);
    }

    private void dropStaleNamespaceCustomIdIndex(MongoCollection<Document> mappings) {
        try {
            mappings.dropIndex(STALE_NAMESPACE_CUSTOM_ID_INDEX);
            LOG.info("Dropped the stale unique index {}.{}", COLLECTION, STALE_NAMESPACE_CUSTOM_ID_INDEX);
        } catch (MongoCommandException e) {
            if (e.getErrorCode() != INDEX_NOT_FOUND) {
                throw e;
            }
            LOG.info("No stale {}.{} index to drop", COLLECTION, STALE_NAMESPACE_CUSTOM_ID_INDEX);
        }
    }
}
