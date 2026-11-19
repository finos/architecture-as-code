package org.finos.calm.domain.exception;

/**
 * A partial resource id matched more than one stored resource. The caller must narrow the id;
 * candidates are reported in logs only, never in the client response.
 */
public class AmbiguousResourceIdException extends InvalidResourceIdException {

    public AmbiguousResourceIdException(String message) {
        super(message);
    }
}
