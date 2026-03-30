package org.finos.calm.domain.exception;

public class DomainNotFoundException extends RuntimeException {
    public DomainNotFoundException(String domain) {
        super("Domain does not exist: " + domain);
    }
}
