package org.finos.calm.security.ldap;

import com.unboundid.ldap.sdk.DN;
import com.unboundid.ldap.sdk.Filter;
import com.unboundid.ldap.sdk.LDAPConnection;
import com.unboundid.ldap.sdk.LDAPConnectionPool;
import com.unboundid.ldap.sdk.LDAPException;
import com.unboundid.ldap.sdk.LDAPSearchException;
import com.unboundid.ldap.sdk.ResultCode;
import com.unboundid.ldap.sdk.SearchRequest;
import com.unboundid.ldap.sdk.SearchResultEntry;
import com.unboundid.ldap.sdk.SearchScope;
import org.finos.calm.config.LdapGroupsConfig;
import org.finos.calm.config.LdapGroupsConfig.UserSearch;
import org.finos.calm.config.LdapGroupsConfig.UserSearchPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * One LDAP connection. Usernames and group names are escaped (RFC 4515) before they go into a filter.
 */
class LdapDirectorySession implements DirectorySession {

    private static final Logger LOG = LoggerFactory.getLogger(LdapDirectorySession.class);
    private static final String NO_ATTRIBUTES = SearchRequest.NO_ATTRIBUTES;

    private LDAPConnection connection;
    private final LdapGroupsConfig config;
    private final LDAPConnectionPool pool;
    private boolean failed;

    /**
     * @param pool the pool the connection was borrowed from, or {@code null} if the session owns it.
     */
    LdapDirectorySession(LDAPConnection connection, LdapGroupsConfig config, LDAPConnectionPool pool) {
        this.connection = connection;
        this.config = config;
        this.pool = pool;
    }

    @Override
    public Optional<String> findUserDn(String username) throws DirectoryException {
        boolean first = config.userSearchPolicy() == UserSearchPolicy.first;
        Map<DN, String> matches = new LinkedHashMap<>();
        for (UserSearch search : orderedUserSearches()) {
            Filter filter = parseFilter(search.filter().replace("{0}", Filter.encodeValue(username)));
            for (SearchResultEntry entry : search(search.base().orElseThrow(), search.scope(), filter, first ? 1 : 2,
                    NO_ATTRIBUTES, true)) {
                if (first) {
                    return Optional.of(entry.getDN());
                }
                matches.putIfAbsent(parseDn(entry.getDN()), entry.getDN());
                if (matches.size() > 1) {
                    throw new DirectoryException("More than one directory entry matches user [" + username + "]");
                }
            }
        }
        return matches.values().stream().findFirst();
    }

    @Override
    public Set<String> findMemberGroups(String userDn, Collection<String> groups) throws DirectoryException {
        Map<String, List<String>> requested = new HashMap<>();
        for (String group : new LinkedHashSet<>(groups)) {
            requested.computeIfAbsent(group.toLowerCase(Locale.ROOT), k -> new ArrayList<>()).add(group);
        }
        List<String> names = requested.values().stream().flatMap(List::stream).toList();
        Set<String> found = new HashSet<>();
        int batchSize = config.groupsPerQuery();
        for (int start = 0; start < names.size(); start += batchSize) {
            List<Filter> nameFilters = names.subList(start, Math.min(start + batchSize, names.size())).stream()
                    .map(name -> Filter.createEqualityFilter(config.groupNameAttribute(), name))
                    .toList();
            Filter filter = Filter.createANDFilter(
                    Filter.createEqualityFilter(config.memberAttribute(), userDn),
                    Filter.createORFilter(nameFilters));
            for (SearchResultEntry entry : search(config.groupSearchBase().orElseThrow(), config.groupSearchScope(),
                    filter, 0, config.groupNameAttribute(), false)) {
                String[] values = entry.getAttributeValues(config.groupNameAttribute());
                if (values != null) {
                    for (String value : values) {
                        found.addAll(requested.getOrDefault(value.toLowerCase(Locale.ROOT), List.of()));
                    }
                }
            }
        }
        return found;
    }

    /**
     * @param missingBaseIsEmpty if true, a base that does not exist gives no entries instead of
     *                           failing, so that one stale user search does not stop the others.
     */
    private List<SearchResultEntry> search(String base, LdapGroupsConfig.Scope scope, Filter filter, int limit,
                                           String attribute, boolean missingBaseIsEmpty) throws DirectoryException {
        SearchRequest request = searchRequest(base, scope, filter, limit, attribute);
        try {
            return searchWithRetry(request);
        } catch (LDAPSearchException e) {
            if (e.getResultCode() == ResultCode.SIZE_LIMIT_EXCEEDED) {
                return e.getSearchEntries();
            }
            if (missingBaseIsEmpty && e.getResultCode() == ResultCode.NO_SUCH_OBJECT) {
                LOG.warn("LDAP search base [{}] does not exist; treating it as no match", base);
                return List.of();
            }
            failed = true;
            throw new DirectoryException("LDAP search under [" + base + "] failed: " + e.getMessage(), e);
        }
    }

    /**
     * Retries once on a fresh connection when a pooled connection is no longer usable, for
     * example after the server closed it while it was idle in the pool.
     */
    private List<SearchResultEntry> searchWithRetry(SearchRequest request) throws LDAPSearchException {
        try {
            return connection.search(request).getSearchEntries();
        } catch (LDAPSearchException e) {
            if (pool == null || ResultCode.isConnectionUsable(e.getResultCode())) {
                throw e;
            }
            try {
                connection = pool.replaceDefunctConnection(connection);
            } catch (LDAPException replaceFailure) {
                connection = null;
                throw e;
            }
            return connection.search(request).getSearchEntries();
        }
    }

    /**
     * The server-side time limit is {@code read-timeout} in whole seconds (at least 1), so the
     * server stops no later than the client gives up.
     */
    SearchRequest searchRequest(String base, LdapGroupsConfig.Scope scope, Filter filter, int limit, String attribute) {
        SearchRequest request = new SearchRequest(base, searchScope(scope), filter, attribute);
        request.setSizeLimit(limit);
        request.setTimeLimitSeconds((int) Math.max(1, config.readTimeout().toSeconds()));
        return request;
    }

    private static SearchScope searchScope(LdapGroupsConfig.Scope scope) {
        return switch (scope) {
            case object -> SearchScope.BASE;
            case onelevel -> SearchScope.ONE;
            case subtree -> SearchScope.SUB;
        };
    }

    private List<UserSearch> orderedUserSearches() {
        return config.userSearches().values().stream()
                .sorted(Comparator.comparingInt(s -> s.order().orElse(Integer.MAX_VALUE)))
                .toList();
    }

    private static Filter parseFilter(String filter) throws DirectoryException {
        try {
            return Filter.create(filter);
        } catch (LDAPException e) {
            throw new DirectoryException("Invalid LDAP user search filter: " + e.getMessage(), e);
        }
    }

    private static DN parseDn(String dn) throws DirectoryException {
        try {
            return new DN(dn);
        } catch (LDAPException e) {
            throw new DirectoryException("The directory returned an invalid DN [" + dn + "]", e);
        }
    }

    @Override
    public void close() {
        if (connection == null) {
            return;
        }
        if (pool == null) {
            connection.close();
        } else if (failed) {
            pool.releaseDefunctConnection(connection);
        } else {
            pool.releaseConnection(connection);
        }
    }
}
