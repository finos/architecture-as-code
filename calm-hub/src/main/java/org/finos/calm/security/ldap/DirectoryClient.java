package org.finos.calm.security.ldap;

/**
 * Opens sessions with a directory. Implementations are thread-safe; a session is not.
 */
public interface DirectoryClient {

    DirectorySession open() throws DirectoryException;
}
