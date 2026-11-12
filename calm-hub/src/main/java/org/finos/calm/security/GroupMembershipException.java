package org.finos.calm.security;

/**
 * A group membership lookup failed. {@link GroupGrants} treats the user as a member of no group.
 */
public class GroupMembershipException extends RuntimeException {

    public GroupMembershipException(String message, Throwable cause) {
        super(message, cause);
    }
}
