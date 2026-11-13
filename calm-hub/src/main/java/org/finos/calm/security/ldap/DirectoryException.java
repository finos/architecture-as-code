package org.finos.calm.security.ldap;

/**
 * A directory operation failed: connect, bind, search or timeout, or an ambiguous user search.
 */
public class DirectoryException extends Exception {

    public DirectoryException(String message) {
        super(message);
    }

    public DirectoryException(String message, Throwable cause) {
        super(message, cause);
    }
}
