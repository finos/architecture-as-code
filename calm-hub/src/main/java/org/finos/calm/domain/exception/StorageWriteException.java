package org.finos.calm.domain.exception;

/**
 * Thrown when a write to the backing store fails for an operational reason (as opposed to the
 * resource simply not existing). Distinguishes the specific "storage capacity exceeded" case
 * (e.g. MongoDB's 16MB BSON document limit) from other write failures so callers can respond
 * with an accurate status code rather than a misleading not-found error.
 */
public class StorageWriteException extends RuntimeException {

    private final boolean capacityExceeded;

    private StorageWriteException(String message, Throwable cause, boolean capacityExceeded) {
        super(message, cause);
        this.capacityExceeded = capacityExceeded;
    }

    public static StorageWriteException capacityExceeded(Throwable cause) {
        return new StorageWriteException("Storage capacity exceeded", cause, true);
    }

    public static StorageWriteException writeFailed(Throwable cause) {
        return new StorageWriteException("Storage write failed", cause, false);
    }

    public boolean isCapacityExceeded() {
        return capacityExceeded;
    }
}
