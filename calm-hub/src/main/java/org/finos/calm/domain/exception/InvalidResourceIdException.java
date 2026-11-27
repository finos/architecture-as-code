package org.finos.calm.domain.exception;

/**
 * Signals that a resource id cannot be interpreted for the active storage mode, or that a
 * GitHub-mode partial key matched more than one registry entry.
 */
public class InvalidResourceIdException extends RuntimeException {

    public InvalidResourceIdException(String message) {
        super(message);
    }
}
