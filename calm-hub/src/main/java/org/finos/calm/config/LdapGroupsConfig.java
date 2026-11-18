package org.finos.calm.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/**
 * Settings for the LDAP group membership provider ({@code calm.auth.groups.provider=ldap}).
 * Every setting is optional or has a default, so a deployment without LDAP needs none of them.
 * {@link LdapGroupsConfigValidator} checks the settings at startup when the LDAP provider is selected.
 */
@ConfigMapping(prefix = "calm.auth.groups.ldap")
public interface LdapGroupsConfig {

    Optional<String> url();

    Optional<AuthMode> authMode();

    Optional<String> bindDn();

    Optional<String> bindPassword();

    @WithDefault("false")
    boolean startTls();

    Optional<String> truststore();

    Optional<String> truststorePassword();

    @WithDefault("false")
    boolean canonicalizeHost();

    @WithDefault("PT5S")
    Duration connectTimeout();

    @WithDefault("PT10S")
    Duration readTimeout();

    @WithDefault("false")
    boolean pool();

    /** The maximum number of pooled connections. Has no effect unless {@link #pool()} is true. */
    @WithDefault("10")
    int poolSize();

    @WithDefault("unique")
    UserSearchPolicy userSearchPolicy();

    Map<String, UserSearch> userSearches();

    Optional<String> groupSearchBase();

    @WithDefault("onelevel")
    Scope groupSearchScope();

    @WithDefault("cn")
    String groupNameAttribute();

    @WithDefault("member")
    String memberAttribute();

    @WithDefault("100")
    int groupsPerQuery();

    Cache cache();

    Gssapi gssapi();

    interface Gssapi {
        /**
         * Passed to UnboundID, which sets {@code javax.security.auth.useSubjectCredsOnly} to this
         * value before each GSSAPI bind. {@code false} lets the bind use the Kerberos ticket cache.
         */
        @WithDefault("false")
        boolean useSubjectCredsOnly();
    }

    interface UserSearch {
        Optional<String> base();

        /** {@code {0}} is replaced by the escaped username. */
        @WithDefault("(uid={0})")
        String filter();

        @WithDefault("onelevel")
        Scope scope();

        Optional<Integer> order();
    }

    interface Cache {
        @WithDefault("PT5M")
        Duration positiveTtl();

        @WithDefault("PT1M")
        Duration negativeTtl();

        @WithDefault("PT10M")
        Duration dnTtl();

        @WithDefault("10000")
        long maxSize();
    }

    enum AuthMode {
        none,
        simple,
        gssapi
    }

    enum Scope {
        onelevel,
        subtree,
        object
    }

    enum UserSearchPolicy {
        unique,
        first
    }
}
