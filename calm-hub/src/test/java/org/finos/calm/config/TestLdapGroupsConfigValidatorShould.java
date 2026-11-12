package org.finos.calm.config;

import org.finos.calm.config.LdapGroupsConfig.AuthMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestLdapGroupsConfigValidatorShould {

    private LdapGroupsConfigStub config;

    @BeforeEach
    void validConfig() {
        config = new LdapGroupsConfigStub();
        config.url = "ldaps://ldap.example.com";
        config.authMode = AuthMode.simple;
        config.bindDn = "cn=calm-hub,ou=services,dc=example,dc=com";
        config.bindPassword = "secret";
        config.userSearch("people", "ou=people,dc=example,dc=com", 0);
        config.groupSearchBase = "ou=groups,dc=example,dc=com";
    }

    private List<String> validateLdap() {
        return LdapGroupsConfigValidator.validate("ldap", config, false);
    }

    private static org.hamcrest.Matcher<Iterable<? super String>> anError(String text) {
        return hasItem(containsString(text));
    }

    @Test
    void accept_a_valid_ldap_config() {
        assertThat(validateLdap(), is(empty()));
    }

    @Test
    void ignore_ldap_settings_for_provider_none() {
        assertThat(LdapGroupsConfigValidator.validate("none", new LdapGroupsConfigStub(), true), is(empty()));
    }

    @Test
    void reject_an_unknown_provider() {
        assertThat(LdapGroupsConfigValidator.validate("kerberos", config, false),
                contains(containsString("calm.auth.groups.provider must be one of [ldap, none], but was 'kerberos'")));
    }

    @Test
    void reject_ldap_in_a_native_image() {
        assertThat(LdapGroupsConfigValidator.validate("ldap", config, true), anError("not supported in native images"));
    }

    @Test
    void require_the_url() {
        config.url = null;
        assertThat(validateLdap(), anError("url is required"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://ldap.example.com", "ldap.example.com", "ldap://bad host"})
    void reject_a_url_that_is_not_ldap(String url) {
        config.url = url;
        assertThat(validateLdap(), anError("url must be an ldap:// or ldaps:// URL"));
    }

    @Test
    void reject_start_tls_with_ldaps() {
        config.startTls = true;
        assertThat(validateLdap(), anError("start-tls cannot be used with an ldaps:// URL"));
    }

    @Test
    void reject_pool_with_start_tls() {
        config.url = "ldap://ldap.example.com";
        config.startTls = true;
        config.pool = true;
        assertThat(validateLdap(), contains(containsString("pool cannot be used with start-tls")));
    }

    @Test
    void require_the_auth_mode() {
        config.authMode = null;
        assertThat(validateLdap(), anError("auth-mode is required"));
    }

    @Test
    void require_bind_credentials_for_simple() {
        config.bindDn = null;
        config.bindPassword = null;
        assertThat(validateLdap(), anError("bind-dn is required"));
        assertThat(validateLdap(), anError("bind-password is required"));
    }

    @Test
    void reject_simple_over_plain_ldap() {
        config.url = "ldap://ldap.example.com";
        assertThat(validateLdap(), anError("sends the password in clear text"));
    }

    @Test
    void accept_simple_over_ldap_with_start_tls() {
        config.url = "ldap://ldap.example.com";
        config.startTls = true;
        assertThat(validateLdap(), is(empty()));
    }

    @Test
    void accept_none_over_plain_ldap() {
        config.url = "LDAP://ldap.example.com";
        config.authMode = AuthMode.none;
        assertThat(validateLdap(), is(empty()));
    }

    @Test
    void accept_gssapi_without_a_jvm_option() {
        config.authMode = AuthMode.gssapi;
        assertThat(validateLdap(), is(empty()));
    }

    @Test
    void reject_a_truststore_that_cannot_be_loaded() {
        config.truststore = "/does/not/exist.p12";
        assertThat(validateLdap(), anError("truststore cannot be loaded"));
    }

    @Test
    void require_at_least_one_user_search() {
        config.userSearches.clear();
        assertThat(validateLdap(), anError("at least one calm.auth.groups.ldap.user-searches.<name> is required"));
    }

    @Test
    void check_each_user_search() {
        config.userSearch("staff", null, null);
        config.userSearch("staff").filter = "(uid=alice)";
        List<String> errors = validateLdap();
        assertThat(errors, anError("user-searches.staff.base is required"));
        assertThat(errors, anError("user-searches.staff.filter must contain {0}"));
        assertThat(errors, anError("user-searches.staff.order is required"));
    }

    @Test
    void reject_a_repeated_user_search_order() {
        config.userSearch("architects", "ou=architects,dc=example,dc=com", 0);
        assertThat(validateLdap(), contains(containsString("user-searches.people.order 0 is also used by user search 'architects'")));
    }

    @Test
    void require_the_group_search_base() {
        config.groupSearchBase = null;
        assertThat(validateLdap(), anError("group-search-base is required"));
    }

    @Test
    void check_numbers_and_durations() {
        config.groupsPerQuery = 0;
        config.poolSize = 0;
        config.connectTimeout = Duration.ZERO;
        config.readTimeout = Duration.ofSeconds(-1);
        config.cache.positiveTtl = Duration.ofSeconds(-1);
        config.cache.negativeTtl = Duration.ofSeconds(-1);
        config.cache.dnTtl = Duration.ofSeconds(-1);
        config.cache.maxSize = 0;
        assertThat(validateLdap(), hasSize(8));
        assertThat(validateLdap(), anError("pool-size must be at least 1"));
    }

    @Test
    void accept_zero_cache_ttls() {
        config.cache.positiveTtl = Duration.ZERO;
        config.cache.negativeTtl = Duration.ZERO;
        config.cache.dnTtl = Duration.ZERO;
        assertThat(validateLdap(), is(empty()));
    }

    @Test
    void fail_startup_with_all_errors() {
        LdapGroupsConfigValidator validator = new LdapGroupsConfigValidator();
        validator.provider = "ldap";
        config.url = null;
        config.groupSearchBase = null;

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> validator.onStartup(null, config));
        assertThat(e.getMessage(), containsString("url is required; "));
        assertThat(e.getMessage(), containsString("group-search-base is required"));
    }

    @Test
    void start_with_provider_none() {
        LdapGroupsConfigValidator validator = new LdapGroupsConfigValidator();
        validator.provider = "none";
        validator.onStartup(null, new LdapGroupsConfigStub());
    }
}
