package org.finos.calm.store.util;

import com.mongodb.MongoWriteException;
import org.finos.calm.domain.exception.StorageWriteException;

/**
 * Classifies a {@link MongoWriteException} that occurred while writing a version's content
 * (as opposed to the "duplicate key on namespace/domain creation" race handled by
 * {@link MongoUpsertPush}), so callers can surface an accurate error rather than mismapping
 * every write failure to a not-found response.
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

    public static boolean isDocumentTooLarge(MongoWriteException ex) {
        return ex.getError().getCode() == DOCUMENT_TOO_LARGE_ERROR_CODE;
    }
}
