package org.finos.calm.domain.exception;

public class DomainAlreadyExistsException extends Exception {
    public DomainAlreadyExistsException(String message) {
        super(message);
    }
}
