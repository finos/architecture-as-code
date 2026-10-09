package org.finos.calm.domain.exception;

/**
 * Thrown when a write is attempted against the read-only GitHub storage backend.
 */
public class GitHubWriteNotSupportedException extends GitHubOperationNotSupportedException {

    public GitHubWriteNotSupportedException(String message) {
        super(message);
    }
}