package org.finos.calm.domain.exception;

/** An operation that GitHub storage mode does not support. Mapped to 501. */
public class GitHubModeNotSupportedException extends UnsupportedOperationException {

    public GitHubModeNotSupportedException(String message) {
        super(message);
    }
}
