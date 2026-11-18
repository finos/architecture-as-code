package org.finos.calm.security;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;

import java.util.Collection;
import java.util.Set;

/**
 * Default {@link GroupMembershipResolver}: no user is a member of any group, so group grants
 * give no access.
 */
@LookupIfProperty(name = GroupMembershipResolverProducer.PROVIDER_PROPERTY,
        stringValue = GroupMembershipResolverProducer.NONE, lookupIfMissing = true)
@Typed(NoGroupMembershipResolver.class)
@ApplicationScoped
public class NoGroupMembershipResolver implements GroupMembershipResolver {

    @Override
    public Set<String> memberGroups(String username, Collection<String> groups) {
        return Set.of();
    }
}
