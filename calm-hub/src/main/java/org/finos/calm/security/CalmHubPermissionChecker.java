package org.finos.calm.security;

import io.quarkus.security.PermissionChecker;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.UserAction;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;


@ApplicationScoped
public class CalmHubPermissionChecker {
    private static final Logger logger = LoggerFactory.getLogger(CalmHubPermissionChecker.class);
    public static final String GLOBAL_ACCESS = "GLOBAL";

    private final UserAccessStore userAccessStore;

    @Inject
    @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false")
    boolean authEnabled;

    @Inject
    @ConfigProperty(name = "calm.auth.allow-public-read", defaultValue = "false")
    boolean allowPublicRead;

    public CalmHubPermissionChecker(UserAccessStore userAccessStore) {
        this.userAccessStore = userAccessStore;
        if (!authEnabled) {
            logger.warn("Caution: CalmHub is starting with authentication disabled. All user access will be granted by default.");
        }
    }

    private boolean isAuthDisabled() {
        if (!authEnabled) {
            logger.debug("Authentication is disabled. Granting user access unconditionally.");
            return true;
        }
        return false;
    }

    private boolean isAllowPublicRead() {
        if (allowPublicRead) {
            logger.debug("calm.auth.allow-public-read is true. Granting unconditional read access to all users.");
            return true;
        }
        return false;
    }

    @PermissionChecker(CalmHubScopes.ADMIN)
    public boolean allowNamespaceAdmin(SecurityIdentity identity, String namespace) {
        return isAuthDisabled()
                || hasNamespaceAccess(identity, namespace, UserAction.ADMIN);
    }

    @PermissionChecker(CalmHubScopes.READ)
    public boolean canRead(SecurityIdentity identity, String namespace) {
        return isAuthDisabled()
                || isAllowPublicRead()
                || hasNamespaceAccess(identity, namespace, UserAction.READ);
    }

    @PermissionChecker(CalmHubScopes.DOMAIN_READ)
    public boolean canReadByDomain(SecurityIdentity identity, String domain) {
        return isAuthDisabled()
                || isAllowPublicRead()
                || hasDomainAccess(identity, domain, UserAction.READ);
    }

    @PermissionChecker(CalmHubScopes.WRITE)
    public boolean canWrite(SecurityIdentity identity, String namespace) {
        return isAuthDisabled()
                || hasNamespaceAccess(identity, namespace, UserAction.WRITE);
    }

    @PermissionChecker(CalmHubScopes.DOMAIN_WRITE)
    public boolean canWriteByDomain(SecurityIdentity identity, String domain) {
        return isAuthDisabled()
                || hasDomainAccess(identity, domain, UserAction.WRITE);
    }

    @PermissionChecker(CalmHubScopes.DOMAIN_ADMIN)
    public boolean allowDomainAdmin(SecurityIdentity identity, String domain) {
        return isAuthDisabled()
                || hasDomainAccess(identity, domain, UserAction.ADMIN);
    }

    @PermissionChecker(CalmHubScopes.GLOBAL_ADMIN)
    public boolean hasGlobalAdmin(SecurityIdentity identity) {
        if (!authEnabled) {
            // specific WARN-level log for admin access
            logger.warn("CalmHub is running with no authentication. Granting user access to ADMIN endpoints unconditionally.");
            return true;
        }
        String username = identity.getPrincipal().getName();
        logger.debug("Checking global admin access for user [{}]", username);
        try {
            boolean granted =
                    userAccessStore.getUserAccessForUsername(username)
                            .stream()
                            .anyMatch(grant -> GLOBAL_ACCESS.equals(grant.getNamespace())
                                    && permissionSufficient(grant, UserAction.ADMIN));

            if (granted) {
                logger.debug("User [{}] AUTHORIZED for GLOBAL admin privileges", username);
            } else {
                logger.debug("User [{}] DENIED for GLOBAL admin privileges", username);
            }
            return granted;
        } catch (UserAccessNotFoundException e) {
            logger.debug("No access grants found for user [{}]", username);
            return false;
        }
    }

    private boolean hasNamespaceAccess(SecurityIdentity identity, String namespace, UserAction action) {
        if (namespace == null) return false;
        String username = identity.getPrincipal().getName();
        logger.debug("Checking namespace access for user [{}] on namespace [{}] action=[{}]", username, namespace, action);

        List<UserAccess> grants = userAccessStore.getGrantsForUser(username);

        if (isGlobalAdminFromGrants(username, grants)) {
            logger.debug("User [{}] AUTHORIZED for [{}] in namespace [{}] via GLOBAL admin grant", username, action, namespace);
            return true;
        }

        List<String> ancestors = ancestorChain(namespace);
        boolean result = action == UserAction.READ
                ? allAncestorsHaveGrant(ancestors, grants, action)
                : anyAncestorHasGrant(ancestors, grants, action);

        if (result) {
            logger.debug("User [{}] AUTHORIZED for [{}] in namespace [{}]", username, action, namespace);
        } else {
            logger.debug("User [{}] DENIED for [{}] in namespace [{}]", username, action, namespace);
        }
        return result;
    }

    private boolean isGlobalAdminFromGrants(String username, List<UserAccess> grants) {
        return grants.stream()
                .anyMatch(g -> username.equals(g.getUsername())
                        && GLOBAL_ACCESS.equals(g.getNamespace())
                        && permissionSufficient(g, UserAction.ADMIN));
    }

    private boolean allAncestorsHaveGrant(List<String> ancestors, List<UserAccess> grants, UserAction action) {
        return ancestors.stream().allMatch(level ->
                grants.stream().anyMatch(g -> level.equals(g.getNamespace()) && permissionSufficient(g, action)));
    }

    private boolean anyAncestorHasGrant(List<String> ancestors, List<UserAccess> grants, UserAction action) {
        return ancestors.stream().anyMatch(level ->
                grants.stream().anyMatch(g -> level.equals(g.getNamespace()) && permissionSufficient(g, action)));
    }

    static List<String> ancestorChain(String namespace) {
        String[] parts = namespace.split("\\.");
        List<String> chain = new ArrayList<>(parts.length);
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (!sb.isEmpty()) sb.append('.');
            sb.append(part);
            chain.add(sb.toString());
        }
        return chain;
    }

    private boolean hasDomainAccess(SecurityIdentity identity, String domain, UserAction action) {
        if (domain == null) return false;
        String username = identity.getPrincipal().getName();
        logger.debug("Checking domain access for user [{}] on domain [{}] action=[{}]", username, domain, action);

        List<UserAccess> grants = userAccessStore.getGrantsForUser(username);

        if (isGlobalAdminFromGrants(username, grants)) {
            logger.debug("User [{}] AUTHORIZED for [{}] in domain [{}] via GLOBAL admin grant", username, action, domain);
            return true;
        }

        boolean result = grants.stream().anyMatch(g ->
                domain.equals(g.getDomain()) && permissionSufficient(g, action));

        if (result) {
            logger.debug("User [{}] AUTHORIZED for [{}] in domain [{}]", username, action, domain);
        } else {
            logger.debug("User [{}] DENIED for [{}] in domain [{}]", username, action, domain);
        }
        return result;
    }

    private boolean permissionSufficient(UserAccess grant, UserAction action) {
        // NB this is entitlement -> requested action
        // user's roles on left and the thing they're trying to get access to on the right.
        return switch (grant.getPermission()) {
            case read -> action == UserAction.READ;
            case write -> action == UserAction.READ || action == UserAction.WRITE;
            case admin -> true;
        };
    }
}
