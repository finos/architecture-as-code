package org.finos.calm.migration.steps;

import com.mongodb.MongoCommandException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.ReplaceOptions;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.mongo.MongoDecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.finos.calm.store.mongo.MongoDecoratorStore.DECORATOR_FIELD;
import static org.finos.calm.store.mongo.MongoDecoratorStore.DECORATOR_ID_FIELD;
import static org.finos.calm.store.mongo.MongoDecoratorStore.NAMESPACE_FIELD;
import static org.finos.calm.store.mongo.MongoDecoratorStore.TARGET_FIELD;
import static org.finos.calm.store.mongo.MongoDecoratorStore.TYPE_FIELD;

/**
 * Splits the one-document-per-namespace decorator array into one document per decorator.
 *
 * <p>Version 16 → 17 of the schema. See
 * {@code calm-hub/decisions/0019-decorator-storage-one-document-per-decorator.md}.</p>
 *
 * <h2>Safety</h2>
 * <ul>
 *   <li>Idempotent, like {@link MongoVersionSplitMigration}: only documents that still have the
 *       {@code decorators} array are processed, writes are {@code replaceOne(upsert)}, and the
 *       old document is deleted only after all its contents are written.</li>
 *   <li>Duplicate {@code decoratorId}s in one namespace stop the step, because an upsert would
 *       keep only one of them. As for any failed step, {@code SchemaMigrationRunner} keeps the
 *       migration lock and CALM Hub refuses requests until an operator removes the duplicate
 *       and clears the lock.</li>
 *   <li>Entries without an integer {@code decoratorId} or a {@code decorator} object were
 *       never returned by the API. They are kept in {@value #UNMIGRATED_COLLECTION} and not
 *       deleted.</li>
 * </ul>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoDecoratorSplitStep implements SchemaMigrationStep {

    static final String UNMIGRATED_COLLECTION = "decoratorsUnmigrated";

    private static final Logger LOG = LoggerFactory.getLogger(MongoDecoratorSplitStep.class);
    private static final String OLD_ARRAY_FIELD = "decorators";
    private static final String OLD_NAMESPACE_INDEX = "namespace_1";
    private static final int INDEX_NOT_FOUND = 27;

    private final MongoCollection<Document> decorators;
    private final MongoCollection<Document> unmigrated;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoDecoratorSplitStep(MongoDatabase database) {
        this.decorators = database.getCollection(MongoDecoratorStore.COLLECTION_NAME);
        this.unmigrated = database.getCollection(UNMIGRATED_COLLECTION);
    }

    @Override
    public int fromVersion() {
        return 16;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping decorator split (database mode: {})", databaseMode);
            return;
        }
        migrate();
    }

    /** Runs without the database mode check. Public so that integration tests can call it. */
    public void migrate() {
        transitionIndexes();

        List<Object> oldDocumentIds = decorators.find(Filters.exists(OLD_ARRAY_FIELD))
                .projection(Projections.include("_id"))
                .into(new ArrayList<>())
                .stream()
                .map(doc -> doc.get("_id"))
                .toList();

        int migrated = 0;
        for (Object oldId : oldDocumentIds) {
            Document old = decorators.find(Filters.eq("_id", oldId)).first();
            if (old != null) {
                migrated += splitNamespaceDocument(old);
            }
        }
        LOG.info("Decorator split complete: {} namespace document(s), {} decorator(s)",
                oldDocumentIds.size(), migrated);
    }

    void transitionIndexes() {
        try {
            decorators.dropIndex(OLD_NAMESPACE_INDEX);
            LOG.info("Dropped the old unique index decorators.{}", OLD_NAMESPACE_INDEX);
        } catch (MongoCommandException e) {
            if (e.getErrorCode() != INDEX_NOT_FOUND) {
                throw e;
            }
            LOG.info("Old unique index decorators.{} was already absent", OLD_NAMESPACE_INDEX);
        }

        decorators.createIndex(new Document(NAMESPACE_FIELD, 1).append(DECORATOR_ID_FIELD, 1),
                new IndexOptions().unique(true));
        decorators.createIndex(new Document(NAMESPACE_FIELD, 1).append(TARGET_FIELD, 1).append(TYPE_FIELD, 1));
        LOG.info("Ensured indexes on decorators.(namespace, decoratorId) and decorators.(namespace, target, type)");
    }

    private int splitNamespaceDocument(Document old) {
        String namespace = old.getString(NAMESPACE_FIELD);
        List<Document> entries = old.getList(OLD_ARRAY_FIELD, Document.class, List.of());

        List<Document> valid = new ArrayList<>();
        List<Document> invalid = new ArrayList<>();
        Set<Integer> seenIds = new HashSet<>();
        for (Document entry : entries) {
            Object id = entry.get(DECORATOR_ID_FIELD);
            Object decorator = entry.get(DECORATOR_FIELD);
            if (!(id instanceof Integer decoratorId) || !(decorator instanceof Document)) {
                invalid.add(entry);
            } else if (!seenIds.add(decoratorId)) {
                throw new IllegalStateException("Namespace '" + namespace + "' has more than one decorator with id "
                        + decoratorId + ". Remove the duplicate, clear the migration lock, then restart CALM Hub.");
            } else {
                valid.add(entry);
            }
        }

        ReplaceOptions upsert = new ReplaceOptions().upsert(true);
        for (Document entry : valid) {
            int decoratorId = entry.getInteger(DECORATOR_ID_FIELD);
            decorators.replaceOne(
                    Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(DECORATOR_ID_FIELD, decoratorId)),
                    MongoDecoratorStore.toStoredDocument(namespace, decoratorId, entry.get(DECORATOR_FIELD, Document.class)),
                    upsert);
        }

        if (!invalid.isEmpty()) {
            unmigrated.replaceOne(Filters.eq(NAMESPACE_FIELD, namespace),
                    new Document(NAMESPACE_FIELD, namespace).append(OLD_ARRAY_FIELD, invalid), upsert);
            LOG.warn("Namespace '{}': kept {} decorator entr(y/ies) with no valid id or content in {}",
                    namespace, invalid.size(), UNMIGRATED_COLLECTION);
        }

        decorators.deleteOne(Filters.eq("_id", old.get("_id")));
        return valid.size();
    }
}
