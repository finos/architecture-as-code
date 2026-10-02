package org.finos.calm.security;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Resolves user access by checking SecurityIdentity roles (populated from the
 * token's "groups" claim via {@code quarkus.oidc.roles.role-claim-path=groups})
 * against the required access groups for a namespace.
 */
@ApplicationScoped
public class OidcRoleResolver {

    private static final Logger LOG = LoggerFactory.getLogger(OidcRoleResolver.class);

    @Inject
    @ConfigProperty(name = "calm.oidc.roles.access", defaultValue = "")
    Optional<String> globalAccessGroups;

    public enum AccessLevel { READ, NONE }

    /**
     * Checks if the user belongs to any of the specified access groups.
     * Groups come from the token's "groups" claim mapped to SecurityIdentity roles.
     */
    public AccessLevel resolve(SecurityIdentity identity, Set<String> accessGroups) {
        if (identity == null || identity.isAnonymous()) {
            return AccessLevel.NONE;
        }

        Set<String> requiredGroups = accessGroups.isEmpty() ? parseConfig(globalAccessGroups) : accessGroups;

        if (requiredGroups.isEmpty()) {
            LOG.warn("No access groups configured. No access will be granted.");
            return AccessLevel.NONE;
        }

        Set<String> userGroups = identity.getRoles();

        if (userGroups == null || userGroups.isEmpty()) {
            LOG.debug("User [{}] has no groups in token. Ensure the IdP emits a 'groups' claim.",
                    identity.getPrincipal().getName());
            return AccessLevel.NONE;
        }

        for (String group : userGroups) {
            if (requiredGroups.contains(group)) {
                LOG.debug("User [{}] matched access group [{}]", identity.getPrincipal().getName(), group);
                return AccessLevel.READ;
            }
        }

        LOG.debug("User [{}] has no matching access groups. User groups: {}, required: {}",
                identity.getPrincipal().getName(), userGroups, requiredGroups);
        return AccessLevel.NONE;
    }

    private Set<String> parseConfig(Optional<String> config) {
        if (config.isEmpty() || config.get().isBlank()) {
            return Set.of();
        }
        return Stream.of(config.get().split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }
}
