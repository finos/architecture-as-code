package org.finos.calm.config;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * A mutable {@link LdapGroupsConfig} for tests, with the same defaults as the mapping.
 */
public class LdapGroupsConfigStub implements LdapGroupsConfig {

    public String url;
    public AuthMode authMode;
    public String bindDn;
    public String bindPassword;
    public boolean startTls;
    public String truststore;
    public String truststorePassword;
    public boolean canonicalizeHost;
    public Duration connectTimeout = Duration.ofSeconds(5);
    public Duration readTimeout = Duration.ofSeconds(10);
    public boolean pool;
    public int poolSize = 10;
    public UserSearchPolicy userSearchPolicy = UserSearchPolicy.unique;
    public final Map<String, UserSearch> userSearches = new LinkedHashMap<>();
    public String groupSearchBase;
    public Scope groupSearchScope = Scope.onelevel;
    public String groupNameAttribute = "cn";
    public String memberAttribute = "member";
    public int groupsPerQuery = 100;
    public final CacheStub cache = new CacheStub();
    public final GssapiStub gssapi = new GssapiStub();

    public LdapGroupsConfigStub userSearch(String name, String base, Integer order) {
        UserSearchStub search = new UserSearchStub();
        search.base = base;
        search.order = order;
        userSearches.put(name, search);
        return this;
    }

    public UserSearchStub userSearch(String name) {
        return (UserSearchStub) userSearches.get(name);
    }

    @Override public Optional<String> url() { return Optional.ofNullable(url); }
    @Override public Optional<AuthMode> authMode() { return Optional.ofNullable(authMode); }
    @Override public Optional<String> bindDn() { return Optional.ofNullable(bindDn); }
    @Override public Optional<String> bindPassword() { return Optional.ofNullable(bindPassword); }
    @Override public boolean startTls() { return startTls; }
    @Override public Optional<String> truststore() { return Optional.ofNullable(truststore); }
    @Override public Optional<String> truststorePassword() { return Optional.ofNullable(truststorePassword); }
    @Override public boolean canonicalizeHost() { return canonicalizeHost; }
    @Override public Duration connectTimeout() { return connectTimeout; }
    @Override public Duration readTimeout() { return readTimeout; }
    @Override public boolean pool() { return pool; }
    @Override public int poolSize() { return poolSize; }
    @Override public UserSearchPolicy userSearchPolicy() { return userSearchPolicy; }
    @Override public Map<String, UserSearch> userSearches() { return userSearches; }
    @Override public Optional<String> groupSearchBase() { return Optional.ofNullable(groupSearchBase); }
    @Override public Scope groupSearchScope() { return groupSearchScope; }
    @Override public String groupNameAttribute() { return groupNameAttribute; }
    @Override public String memberAttribute() { return memberAttribute; }
    @Override public int groupsPerQuery() { return groupsPerQuery; }
    @Override public Cache cache() { return cache; }
    @Override public Gssapi gssapi() { return gssapi; }

    public static class GssapiStub implements Gssapi {
        public boolean useSubjectCredsOnly;

        @Override public boolean useSubjectCredsOnly() { return useSubjectCredsOnly; }
    }

    public static class UserSearchStub implements UserSearch {
        public String base;
        public String filter = "(uid={0})";
        public Scope scope = Scope.onelevel;
        public Integer order;

        @Override public Optional<String> base() { return Optional.ofNullable(base); }
        @Override public String filter() { return filter; }
        @Override public Scope scope() { return scope; }
        @Override public Optional<Integer> order() { return Optional.ofNullable(order); }
    }

    public static class CacheStub implements Cache {
        public Duration positiveTtl = Duration.ofMinutes(5);
        public Duration negativeTtl = Duration.ofMinutes(1);
        public Duration dnTtl = Duration.ofMinutes(10);
        public long maxSize = 10000;

        @Override public Duration positiveTtl() { return positiveTtl; }
        @Override public Duration negativeTtl() { return negativeTtl; }
        @Override public Duration dnTtl() { return dnTtl; }
        @Override public long maxSize() { return maxSize; }
    }
}
