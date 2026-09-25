package org.finos.calm.domain.exception;

public class GitHubWriteNotSupportedException extends UnsupportedOperationException {

    public GitHubWriteNotSupportedException(String message) {
        super(message);
    }
}
