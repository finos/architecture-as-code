package org.finos.calm.security;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * Decides which groups a user is a member of, so that group grants in the user-access
 * store apply to the user.
 *
 * <p>{@code calm.auth.groups.provider} selects a built-in implementation: {@code none} (the
 * default, {@link NoGroupMembershipResolver}) or {@code ldap}. To use another membership source,
 * add an {@code @ApplicationScoped} implementation of this interface in source; it replaces the
 * built-in one.
 *
 * <p>Only direct membership is in scope. An exception thrown from either method counts as
 * "not a member" for every group in the call.
 */
public interface GroupMembershipResolver {

    /**
     * @param username the name of the authenticated principal.
     * @param groups   the group names stored in the candidate grants.
     * @return the groups of which the user is a direct member (empty if none).
     */
    Set<String> memberGroups(String username, Collection<String> groups);

    /**
     * @param username the name of the authenticated principal.
     * @param group    the group name stored in the grant.
     * @return {@code true} if the user is a direct member of the group.
     */
    default boolean isMember(String username, String group) {
        return memberGroups(username, List.of(group)).contains(group);
    }
}
