package org.finos.calm.store.util;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import org.bson.Document;
import org.bson.conversions.Bson;

/**
 * Shared helper for the "one document per namespace/domain, entities appended via
 * {@code $push} with {@code upsert: true}" pattern used across the namespace/domain-scoped
 * Mongo stores.
 *
 * <h2>Why this exists</h2>
 * The upsert-insert that creates the very first entity in a brand-new namespace/domain can
 * race with a concurrent request doing the same thing: the unique index on the namespace/domain
 * field (see {@code MongoIndexInitializationStep}) lets exactly one of them insert, and the loser gets
 * a {@link MongoWriteException} with {@link ErrorCategory#DUPLICATE_KEY} instead of a matched
 * document to push into. Retrying the same push once the document exists resolves this safely
 * with no data loss, instead of surfacing a spurious 500.
 */
public final class MongoUpsertPush {

    private MongoUpsertPush() {
    }

    public static void pushWithDuplicateRetry(MongoCollection<Document> collection, Bson filter,
                                               String arrayField, Document entry) {
        Bson update = Updates.push(arrayField, entry);
        UpdateOptions options = new UpdateOptions().upsert(true);
        try {
            collection.updateOne(filter, update, options);
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() != ErrorCategory.DUPLICATE_KEY) {
                throw e;
            }
            // Lost the race to create the namespace/domain document — it exists now, retry the push.
            collection.updateOne(filter, update, options);
        }
    }
}
