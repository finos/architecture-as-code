package org.finos.calm.security;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.security.ldap.LdapGroupMembershipResolver;

/**
 * Selects the built-in {@link GroupMembershipResolver} from {@code calm.auth.groups.provider}.
 * A deployment that adds its own {@code GroupMembershipResolver} bean replaces this one.
 */
@ApplicationScoped
public class GroupMembershipResolverProducer {

    public static final String PROVIDER_PROPERTY = "calm.auth.groups.provider";
    public static final String NONE = "none";
    public static final String LDAP = "ldap";

    @Inject
    @ConfigProperty(name = PROVIDER_PROPERTY, defaultValue = NONE)
    String provider;

    @Inject
    Instance<NoGroupMembershipResolver> noGroupMembershipResolver;

    @Inject
    Instance<LdapGroupMembershipResolver> ldapGroupMembershipResolver;

    @Produces
    @ApplicationScoped
    @DefaultBean
    public GroupMembershipResolver produce() {
        return switch (provider) {
            case NONE -> noGroupMembershipResolver.get();
            case LDAP -> ldapGroupMembershipResolver.get();
            default -> throw new IllegalStateException(PROVIDER_PROPERTY + " must be '" + NONE + "' or '" + LDAP
                    + "', but was '" + provider + "'");
        };
    }
}
