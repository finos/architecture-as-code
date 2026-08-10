package org.finos.calm.migration.steps;

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
 * Creates the unique index the pattern-layout storage shape needs: one document per
 * {@code (namespace, patternId)} in the {@code pattern_layouts} collection, mirroring
 * {@link MongoLayoutIndexStep} at {@code fromVersion() == 9} for architecture layouts.
 *
 * <h2>Why {@code fromVersion() == 11}</h2>
 * {@code 9} ({@link MongoLayoutIndexStep}) was the highest {@code fromVersion()} in use when
 * this step was first drafted, making {@code 10} the next unused value — but
 * {@code MongoAdrTitleBackfillStep} landed at {@code fromVersion() == 10} first, so this step
 * was moved to {@code 11}. A wrong or duplicate {@code fromVersion()} is a fatal startup
 * {@code IllegalStateException} — see {@code SchemaMigrationRunner}'s duplicate-{@code fromVersion}
 * guard — so this must be re-verified as still unused immediately before implementing, not just
 * once at design time.
 *
 * <h2>Why this needs no data migration</h2>
 * As with {@link MongoLayoutIndexStep}, this is a brand-new collection with no pre-existing
 * data to move — this step only ever needs to establish the index.
 *
 * <h2>Why {@code init-mongo.js} must change too</h2>
 * A freshly-seeded database pins {@code LATEST_SCHEMA_VERSION} directly and never runs any
 * migration step, including this one. {@code calm-hub/mongo/init-mongo.js} must create the same
 * unique index at seed time and bump {@code LATEST_SCHEMA_VERSION} to {@code 12} in the same
 * change, or a fresh install silently ships with no uniqueness guarantee on
 * {@code pattern_layouts} at all.
 *
 * <h2>Mongo-only</h2>
 * Nitrite creates no indexes at all (see {@code NitriteVersionSplitMigration}'s javadoc), so
 * there is no Nitrite twin at this {@code fromVersion()}.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoPatternLayoutIndexStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoPatternLayoutIndexStep.class);

    private static final String COLLECTION = "pattern_layouts";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String PATTERN_ID_FIELD = "patternId";

    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoPatternLayoutIndexStep(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 11;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping pattern layout index creation (database mode: {})", databaseMode);
            return;
        }
        createIndexes();
    }

    /**
     * Creates the index unconditionally — no {@code databaseMode} check. Public, like
     * {@code MongoLayoutIndexStep#createIndexes()}, specifically so integration-test
     * infrastructure with a known-real MongoDB container can call it directly.
     */
    public void createIndexes() {
        MongoCollection<Document> patternLayouts = database.getCollection(COLLECTION);
        patternLayouts.createIndex(new Document(NAMESPACE_FIELD, 1).append(PATTERN_ID_FIELD, 1),
                new IndexOptions().unique(true));
        LOG.info("Ensured unique index on {}.({}, {})", COLLECTION, NAMESPACE_FIELD, PATTERN_ID_FIELD);
    }
}
