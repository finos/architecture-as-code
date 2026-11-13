package org.finos.calm.config;

import io.quarkus.runtime.ImageMode;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.LdapGroupsConfig.AuthMode;
import org.finos.calm.config.LdapGroupsConfig.UserSearch;
import org.finos.calm.security.GroupMembershipResolverProducer;
import org.finos.calm.security.ldap.LdapTls;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Fails startup on an unknown {@code calm.auth.groups.provider}, and, when it is {@code ldap},
 * on a bad {@code calm.auth.groups.ldap.*} value. A bad LDAP setting would otherwise show only as
 * failed lookups, which give no group access.
 */
@ApplicationScoped
public class LdapGroupsConfigValidator {

    private static final String PREFIX = "calm.auth.groups.ldap.";
    private static final Set<String> PROVIDERS = Set.of(GroupMembershipResolverProducer.NONE, GroupMembershipResolverProducer.LDAP);

    @Inject
    @ConfigProperty(name = GroupMembershipResolverProducer.PROVIDER_PROPERTY, defaultValue = GroupMembershipResolverProducer.NONE)
    String provider;

    void onStartup(@Observes StartupEvent event, LdapGroupsConfig config) {
        List<String> errors = validate(provider, config, ImageMode.current().isNativeImage());
        if (!errors.isEmpty()) {
            throw new IllegalStateException("Invalid group membership configuration: " + String.join("; ", errors));
        }
    }

    static List<String> validate(String provider, LdapGroupsConfig config, boolean nativeImage) {
        List<String> errors = new ArrayList<>();
        if (!PROVIDERS.contains(provider)) {
            errors.add(GroupMembershipResolverProducer.PROVIDER_PROPERTY + " must be one of " + PROVIDERS.stream().sorted().toList()
                    + ", but was '" + provider + "'");
            return errors;
        }
        if (!GroupMembershipResolverProducer.LDAP.equals(provider)) {
            return errors;
        }
        if (nativeImage) {
            errors.add("LDAP group membership is not supported in native images; use the JVM image");
        }
        validateConnection(config, errors);
        validateUserSearches(config, errors);
        if (config.groupSearchBase().isEmpty()) {
            errors.add(PREFIX + "group-search-base is required");
        }
        if (config.poolSize() < 1) {
            errors.add(PREFIX + "pool-size must be at least 1");
        }
        if (config.groupsPerQuery() < 1) {
            errors.add(PREFIX + "groups-per-query must be at least 1");
        }
        requirePositive("connect-timeout", config.connectTimeout(), errors);
        if (config.readTimeout().compareTo(Duration.ofSeconds(1)) < 0) {
            errors.add(PREFIX + "read-timeout must be at least 1 second, because it is also the server search time limit");
        }
        requireNotNegative("cache.positive-ttl", config.cache().positiveTtl(), errors);
        requireNotNegative("cache.negative-ttl", config.cache().negativeTtl(), errors);
        requireNotNegative("cache.dn-ttl", config.cache().dnTtl(), errors);
        if (config.cache().maxSize() < 1) {
            errors.add(PREFIX + "cache.max-size must be at least 1");
        }
        return errors;
    }

    private static void validateConnection(LdapGroupsConfig config, List<String> errors) {
        String scheme = config.url().map(LdapGroupsConfigValidator::scheme).orElse(null);
        if (config.url().isEmpty()) {
            errors.add(PREFIX + "url is required");
        } else if (!"ldap".equals(scheme) && !"ldaps".equals(scheme)) {
            errors.add(PREFIX + "url must be an ldap:// or ldaps:// URL");
        }
        if (config.startTls() && "ldaps".equals(scheme)) {
            errors.add(PREFIX + "start-tls cannot be used with an ldaps:// URL");
        }
        if (config.pool() && config.startTls()) {
            errors.add(PREFIX + "pool cannot be used with start-tls");
        }
        if (config.authMode().isEmpty()) {
            errors.add(PREFIX + "auth-mode is required");
        } else if (config.authMode().get() == AuthMode.simple) {
            if (config.bindDn().isEmpty()) {
                errors.add(PREFIX + "bind-dn is required for auth-mode simple");
            }
            if (config.bindPassword().isEmpty()) {
                errors.add(PREFIX + "bind-password is required for auth-mode simple");
            }
            if ("ldap".equals(scheme) && !config.startTls()) {
                errors.add("auth-mode simple sends the password in clear text over ldap://; use an ldaps:// URL or set "
                        + PREFIX + "start-tls=true");
            }
        }
        config.truststore().ifPresent(path -> {
            try {
                LdapTls.socketFactory(path, config.truststorePassword());
            } catch (Exception e) {
                errors.add(PREFIX + "truststore cannot be loaded: " + e.getMessage());
            }
        });
    }

    private static void validateUserSearches(LdapGroupsConfig config, List<String> errors) {
        if (config.userSearches().isEmpty()) {
            errors.add("at least one " + PREFIX + "user-searches.<name> is required");
        }
        Map<Integer, String> orders = new HashMap<>();
        config.userSearches().entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(entry -> {
            String key = PREFIX + "user-searches." + entry.getKey() + ".";
            UserSearch search = entry.getValue();
            if (search.base().isEmpty()) {
                errors.add(key + "base is required");
            }
            if (!search.filter().contains("{0}")) {
                errors.add(key + "filter must contain {0}");
            }
            if (search.order().isEmpty()) {
                errors.add(key + "order is required");
            } else {
                String other = orders.putIfAbsent(search.order().get(), entry.getKey());
                if (other != null) {
                    errors.add(key + "order " + search.order().get() + " is also used by user search '" + other + "'");
                }
            }
        });
    }

    private static String scheme(String url) {
        try {
            String scheme = new URI(url).getScheme();
            return scheme == null ? null : scheme.toLowerCase(Locale.ROOT);
        } catch (URISyntaxException e) {
            return null;
        }
    }

    private static void requirePositive(String name, Duration value, List<String> errors) {
        if (value.isNegative() || value.isZero()) {
            errors.add(PREFIX + name + " must be greater than zero");
        }
    }

    private static void requireNotNegative(String name, Duration value, List<String> errors) {
        if (value.isNegative()) {
            errors.add(PREFIX + name + " must not be negative");
        }
    }
}
