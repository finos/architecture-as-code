package org.finos.calm.store.util;

import com.mongodb.MongoWriteException;
import org.bson.BsonMaximumSizeExceededException;
import org.finos.calm.domain.exception.StorageWriteException;

/**
 * Classifies a write failure that occurred while writing a version's content (as opposed to
 * the "duplicate key on namespace/domain creation" race handled by {@link MongoUpsertPush}), so
 * callers can surface an accurate error rather than mismapping every write failure to a
 * not-found response.
 *
 * <h2>Two distinct ways MongoDB's 16MB ceiling can be hit</h2>
 * A document that accumulates content server-side until it crosses the ceiling (e.g. the old
 * one-document-per-namespace shape) is rejected by the server, and the driver reports that as a
 * {@link MongoWriteException} with the {@code BSONObjectTooLarge} error code.
 * <p>
 * A single write whose content already exceeds the ceiling before it is even sent (e.g. one
 * oversized document being inserted or replaced wholesale) is instead rejected client-side by
 * the driver while serializing the command, as a {@link BsonMaximumSizeExceededException} — a
 * {@code MongoWriteException} is never raised, because the command never reaches the server.
 * Both must map to the same {@link StorageWriteException#capacityExceeded} outcome; a caller
 * that only catches {@code MongoWriteException} would let the second case escape unmapped.
 *
 * <h2>Why {@code getCode()} and not {@link com.mongodb.ErrorCategory}</h2>
 * The driver's {@code ErrorCategory} enum only distinguishes {@code DUPLICATE_KEY} and
 * {@code EXECUTION_TIMEOUT} — there is no category for "document too large", so the specific
 * MongoDB error code must be checked directly.
 */
public final class MongoWriteFailures {

    /** MongoDB's {@code BSONObjectTooLarge} error code — the 16MB-per-document ceiling. */
    private static final int DOCUMENT_TOO_LARGE_ERROR_CODE = 10334;

    private MongoWriteFailures() {
    }

    public static StorageWriteException toStorageWriteException(MongoWriteException ex) {
        if (isDocumentTooLarge(ex)) {
            return StorageWriteException.capacityExceeded(ex);
        }
        return StorageWriteException.writeFailed(ex);
    }

    /**
     * The driver's client-side counterpart to {@link #toStorageWriteException(MongoWriteException)}
     * — always the 16MB ceiling, since the driver only raises this when it refuses to even send
     * the command, so there is no other error to distinguish here.
     */
    public static StorageWriteException toStorageWriteException(BsonMaximumSizeExceededException ex) {
        return StorageWriteException.capacityExceeded(ex);
    }

    public static boolean isDocumentTooLarge(MongoWriteException ex) {
        return ex.getError().getCode() == DOCUMENT_TOO_LARGE_ERROR_CODE;
    }
}
