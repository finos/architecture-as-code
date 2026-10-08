package org.finos.calm.domain.exception;

/**
 * Thrown when an operation has no meaning in GitHub storage mode - for example the admin
 * user-access listings, which in GitHub mode are derived from OIDC roles rather than stored.
 * {@link GitHubWriteNotSupportedException} is the more specific case for attempted writes.
 * Mapped to HTTP 501 by {@code UnsupportedOperationExceptionMapper}.
 */
public class GitHubOperationNotSupportedException extends UnsupportedOperationException {

    public GitHubOperationNotSupportedException(String message) {
        super(message);
    }
}