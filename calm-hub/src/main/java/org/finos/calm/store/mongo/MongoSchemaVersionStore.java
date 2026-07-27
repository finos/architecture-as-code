package org.finos.calm.store.mongo;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import com.mongodb.client.result.UpdateResult;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.store.SchemaVersionStore;

import java.util.Date;

/**
 * MongoDB-backed implementation of {@link SchemaVersionStore}.
 *
 * <p>Stores two documents, each identified by a fixed {@code _id}, in the
 * {@code calm} collection: {@code schemaVersion} (the version marker) and
 * {@code migrationLock} (the cross-instance lock). Neither document exists
 * until first written — {@link #getSchemaVersion()} treats an absent
 * document as version {@code 0}.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoSchemaVersionStore.class)
public class MongoSchemaVersionStore implements SchemaVersionStore {

    private static final String VERSION_DOCUMENT_ID = "schemaVersion";
    private static final String VERSION_FIELD = "version";

    private static final String LOCK_DOCUMENT_ID = "migrationLock";
    private static final String HOLDER_FIELD = "holder";
    private static final String ACQUIRED_AT_FIELD = "acquiredAt";

    private final MongoCollection<Document> calmCollection;

    public MongoSchemaVersionStore(MongoDatabase database) {
        this.calmCollection = database.getCollection("calm");
    }

    @Override
    public int getSchemaVersion() {
        Document doc = calmCollection.find(Filters.eq("_id", VERSION_DOCUMENT_ID)).first();
        return doc == null ? 0 : doc.getInteger(VERSION_FIELD, 0);
    }

    @Override
    public void setSchemaVersion(int version) {
        calmCollection.updateOne(
                Filters.eq("_id", VERSION_DOCUMENT_ID),
                Updates.set(VERSION_FIELD, version),
                new UpdateOptions().upsert(true));
    }

    @Override
    public boolean acquireMigrationLock(String instanceId) {
        // acquiredAt is diagnostic only (so a human investigating a stuck lock can see how
        // long it's been held) — it plays no part in acquisition, which never expires on its own.
        Bson filter = Filters.and(Filters.eq("_id", LOCK_DOCUMENT_ID), Filters.exists(HOLDER_FIELD, false));
        Bson update = Updates.combine(
                Updates.set(HOLDER_FIELD, instanceId),
                Updates.set(ACQUIRED_AT_FIELD, new Date()));
        UpdateOptions options = new UpdateOptions().upsert(true);
        try {
            return tryAcquire(filter, update, options);
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() != ErrorCategory.DUPLICATE_KEY) {
                throw e;
            }
            // Lost the race to create the lock document — it exists now, retry the conditional update once.
            return tryAcquire(filter, update, options);
        }
    }

    private boolean tryAcquire(Bson filter, Bson update, UpdateOptions options) {
        UpdateResult result = calmCollection.updateOne(filter, update, options);
        return result.getModifiedCount() > 0 || result.getUpsertedId() != null;
    }

    @Override
    public void releaseMigrationLock(String instanceId) {
        calmCollection.updateOne(
                Filters.and(Filters.eq("_id", LOCK_DOCUMENT_ID), Filters.eq(HOLDER_FIELD, instanceId)),
                Updates.unset(HOLDER_FIELD));
    }

    @Override
    public boolean isMigrationLockHeld() {
        Document doc = calmCollection.find(Filters.eq("_id", LOCK_DOCUMENT_ID)).first();
        return doc != null && doc.get(HOLDER_FIELD) != null;
    }
}
