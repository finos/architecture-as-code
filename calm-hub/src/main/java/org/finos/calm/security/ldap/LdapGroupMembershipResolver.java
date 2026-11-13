package org.finos.calm.security.ldap;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import com.github.benmanes.caffeine.cache.Ticker;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.config.LdapGroupsConfig;
import org.finos.calm.security.GroupMembershipResolver;
import org.finos.calm.security.GroupMembershipResolverProducer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

/**
 * Resolves group membership from an LDAP directory. Caches each (user, group) answer and each
 * user DN. Asks the directory only about groups that are not in the cache. If the directory
 * fails, the cached answers still count, the uncached groups count as "not a member", and
 * nothing is cached.
 */
@LookupIfProperty(name = GroupMembershipResolverProducer.PROVIDER_PROPERTY, stringValue = GroupMembershipResolverProducer.LDAP)
@Typed(LdapGroupMembershipResolver.class)
@ApplicationScoped
public class LdapGroupMembershipResolver implements GroupMembershipResolver {

    private static final Logger LOG = LoggerFactory.getLogger(LdapGroupMembershipResolver.class);

    private record Membership(String username, String group) {
    }

    private final DirectoryClient directoryClient;
    private final Cache<Membership, Boolean> memberships;
    private final Cache<String, Optional<String>> userDns;

    @Inject
    public LdapGroupMembershipResolver(DirectoryClient directoryClient, LdapGroupsConfig config) {
        this(directoryClient, config, Ticker.systemTicker());
    }

    LdapGroupMembershipResolver(DirectoryClient directoryClient, LdapGroupsConfig config, Ticker ticker) {
        this.directoryClient = directoryClient;
        LdapGroupsConfig.Cache cache = config.cache();
        this.memberships = Caffeine.newBuilder()
                .maximumSize(cache.maxSize())
                .ticker(ticker)
                .expireAfter(Expiry.writing((Membership key, Boolean member) -> member ? cache.positiveTtl() : cache.negativeTtl()))
                .build();
        this.userDns = Caffeine.newBuilder()
                .maximumSize(cache.maxSize())
                .ticker(ticker)
                .expireAfter(Expiry.writing((String key, Optional<String> dn) -> dn.isPresent() ? cache.dnTtl() : cache.negativeTtl()))
                .build();
    }

    @Override
    public Set<String> memberGroups(String username, Collection<String> groups) {
        Set<String> result = new HashSet<>();
        Set<String> uncached = new LinkedHashSet<>();
        for (String group : groups) {
            Boolean member = memberships.getIfPresent(new Membership(username, group));
            if (member == null) {
                uncached.add(group);
            } else if (member) {
                result.add(group);
            }
        }
        if (uncached.isEmpty()) {
            return result;
        }
        Optional<String> cachedDn = userDns.getIfPresent(username);
        if (cachedDn != null && cachedDn.isEmpty()) {
            return result;
        }
        try (DirectorySession session = directoryClient.open()) {
            Optional<String> userDn = cachedDn != null ? cachedDn : session.findUserDn(username);
            if (cachedDn == null) {
                userDns.put(username, userDn);
            }
            if (userDn.isEmpty()) {
                return result;
            }
            Set<String> found = session.findMemberGroups(userDn.get(), uncached);
            for (String group : uncached) {
                boolean member = found.contains(group);
                memberships.put(new Membership(username, group), member);
                if (member) {
                    result.add(group);
                }
            }
            return result;
        } catch (DirectoryException e) {
            LOG.warn("LDAP group membership lookup failed for user [{}]; {} uncached group(s) treated as non-member",
                    username, uncached.size(), e);
            return result;
        }
    }
}
