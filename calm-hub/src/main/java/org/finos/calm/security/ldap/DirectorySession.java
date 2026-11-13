package org.finos.calm.security.ldap;

import java.util.Collection;
import java.util.Optional;
import java.util.Set;

/**
 * One connection to a directory. Use it in a try-with-resources block.
 */
public interface DirectorySession extends AutoCloseable {

    /**
     * @return the DN of the user, or empty if no user search finds the user.
     */
    Optional<String> findUserDn(String username) throws DirectoryException;

    /**
     * @param userDn the DN from {@link #findUserDn}.
     * @param groups group names, as stored in group grants.
     * @return the given group names of which the user is a direct member.
     */
    Set<String> findMemberGroups(String userDn, Collection<String> groups) throws DirectoryException;

    @Override
    void close();
}
