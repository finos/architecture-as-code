package org.finos.calm.security;

import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.UserAccess;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Keeps the group grants whose group the user is a member of. Collects the distinct group
 * names of the given grants into one set and calls
 * {@link GroupMembershipResolver#memberGroups} a single time with that set. If the resolver
 * fails, no group grant survives.
 */
@ApplicationScoped
public class GroupGrants {

    private static final Logger logger = LoggerFactory.getLogger(GroupGrants.class);

    private final GroupMembershipResolver groupMembershipResolver;

    public GroupGrants(GroupMembershipResolver groupMembershipResolver) {
        this.groupMembershipResolver = groupMembershipResolver;
    }

    public List<UserAccess> forMembers(String username, List<UserAccess> groupGrants) {
        if (groupGrants.isEmpty()) {
            return List.of();
        }
        Set<String> candidates = groupGrants.stream()
                .map(UserAccess::getUsername)
                .collect(Collectors.toSet());
        Set<String> memberGroups;
        try {
            memberGroups = groupMembershipResolver.memberGroups(username, candidates);
        } catch (RuntimeException e) {
            logger.warn("Group membership lookup failed for user [{}]; treating as member of no group", username, e);
            return List.of();
        }
        if (memberGroups == null || memberGroups.isEmpty()) {
            return List.of();
        }
        logger.debug("User [{}] is a member of groups {}", username, memberGroups);
        return groupGrants.stream()
                .filter(g -> memberGroups.contains(g.getUsername()))
                .toList();
    }
}
