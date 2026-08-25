package org.finos.calm.store.util;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.ReplaceOptions;
import org.bson.BsonMaximumSizeExceededException;
import org.bson.Document;
import org.bson.conversions.Bson;

/**
 * Shared {@code replaceOne(filter, replacement, upsert(true))}-with-retry mechanics for the
 * "one flat document per (namespace, id)" storage shape used by {@code MongoLayoutStore} and
 * {@code MongoPatternLayoutStore}. See {@code MongoLayoutStore}'s class javadoc for the full
 * rationale — the duplicate-key race this retries once, and why a second duplicate key is a
 * fault rather than a race to keep retrying. This class only extracts the mechanics so the two
 * callers don't duplicate them.
 */
public final class MongoUpsertRetry {

    private MongoUpsertRetry() {
    }

    /**
     * Replaces (or inserts, on no match) a single document, retrying once if the first attempt
     * loses a concurrent insert race on a unique index. Throws {@link org.finos.calm.domain.exception.StorageWriteException}
     * on any non-retryable failure, including a second duplicate key on the retry and the
     * client-side 16MB-document ceiling.
     */
    public static void replaceOnceWithRetry(MongoCollection<Document> collection, Bson filter,
                                             Document replacement, ReplaceOptions upsert) {
        try {
            replaceOne(collection, filter, replacement, upsert);
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() != ErrorCategory.DUPLICATE_KEY) {
                throw MongoWriteFailures.toStorageWriteException(e);
            }
            try {
                replaceOne(collection, filter, replacement, upsert);
            } catch (MongoWriteException retryFailure) {
                throw MongoWriteFailures.toStorageWriteException(retryFailure);
            }
        }
    }

    /**
     * Isolates the two ways MongoDB's 16MB ceiling can surface on this write: a
     * {@link MongoWriteException} when the server rejects an oversized document, or a
     * client-side {@link BsonMaximumSizeExceededException} the driver raises while serializing
     * the command, which never reaches the server and so is never a {@code MongoWriteException}.
     */
    private static void replaceOne(MongoCollection<Document> collection, Bson filter,
                                    Document replacement, ReplaceOptions upsert) {
        try {
            collection.replaceOne(filter, replacement, upsert);
        } catch (BsonMaximumSizeExceededException e) {
            throw MongoWriteFailures.toStorageWriteException(e);
        }
    }
}
