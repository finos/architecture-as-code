package org.finos.calm.security.ldap;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.config.LdapGroupsConfig;
import org.finos.calm.security.GroupMembershipResolver;
import org.finos.calm.security.GroupMembershipResolverProducer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

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
        this.directoryClient = directoryClient;
        LdapGroupsConfig.Cache cache = config.cache();
        this.memberships = Caffeine.newBuilder()
                .maximumSize(cache.maxSize())
                .expireAfter(expiry((Boolean member) -> member ? cache.positiveTtl() : cache.negativeTtl()))
                .build();
        this.userDns = Caffeine.newBuilder()
                .maximumSize(cache.maxSize())
                .expireAfter(expiry((Optional<String> dn) -> dn.isPresent() ? cache.dnTtl() : cache.negativeTtl()))
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
            userDns.put(username, userDn);
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

    private static <K, V> Expiry<K, V> expiry(Function<V, Duration> ttl) {
        return new Expiry<>() {
            @Override
            public long expireAfterCreate(K key, V value, long currentTime) {
                return ttl.apply(value).toNanos();
            }

            @Override
            public long expireAfterUpdate(K key, V value, long currentTime, long currentDuration) {
                return ttl.apply(value).toNanos();
            }

            @Override
            public long expireAfterRead(K key, V value, long currentTime, long currentDuration) {
                return currentDuration;
            }
        };
    }
}
