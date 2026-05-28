package org.finos.calm.security;

import io.quarkus.security.PermissionChecker;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


@ApplicationScoped
public class CalmHubPermissionChecker {
    private static final Logger logger = LoggerFactory.getLogger(CalmHubPermissionChecker.class);

    private final UserAccessStore userAccessStore;

    @Inject
    @ConfigProperty(name = "calm.hub.allow.public.read", defaultValue = "false")
    boolean allowPublicRead;

    public CalmHubPermissionChecker(UserAccessStore userAccessStore) {
        this.userAccessStore = userAccessStore;
    }

    @PermissionChecker(CalmHubScopes.ADMIN)
    public boolean allowNamespaceAdmin(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        return hasAccess(identity, namespace, UserAction.ADMIN);
    }

    @PermissionChecker(CalmHubScopes.READ)
    public boolean canRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (allowPublicRead) return true;
        return hasAccess(identity, namespace, UserAction.READ);
    }

    @PermissionChecker(CalmHubScopes.WRITE)
    public boolean canWrite(SecurityIdentity identity, String namespace) {
        return identity.isAnonymous()
                || hasAccess(identity, namespace, UserAction.WRITE);
    }

    @PermissionChecker(CalmHubScopes.GLOBAL_ADMIN)
    public boolean hasGlobalAdmin(SecurityIdentity identity) {
        if (identity.isAnonymous()) {
            logger.warn("CalmHub is running with no authentication. Granting user access unconditionally.");
            return true;
        }
        String username = identity.getPrincipal().getName();
        logger.debug("Checking global admin access for user [{}]", username);
        try {
            boolean granted =
                    userAccessStore.getUserAccessForUsername(username)
                            .stream()
                            .anyMatch(grant -> namespaceMatches(grant, "GLOBAL")
                                    && permissionSufficient(grant, UserAction.ADMIN));

            if (granted) {
                logger.info("User [{}] AUTHORIZED for GLOBAL admin privileges", username);
            } else {
                logger.warn("User [{}] DENIED for GLOBAL admin privileges", username);
            }
            return granted;
        } catch (UserAccessNotFoundException e) {
            logger.debug("No access grants found for user [{}]", username);
            return false;
        }
    }

    private boolean hasAccess(SecurityIdentity identity, String namespace, UserAction action) {
        String username = identity.getPrincipal().getName();
        logger.debug("Checking access for user [{}] on namespace [{}] action=[{}]",
                username, namespace, action);
        try {
            boolean result = userAccessStore.getUserAccessForUsername(username).stream()
                    .anyMatch(grant -> namespaceMatches(grant, namespace)
                            && permissionSufficient(grant, action));
            if (result) {
                logger.info("User [{}] AUTHORIZED for [{}] in namespace [{}]",
                        username, action, namespace);
            } else {
                logger.warn("User [{}] DENIED for [{}] in namespace [{}]",
                        username, action, namespace);
            }
            return result;
        } catch (UserAccessNotFoundException e) {
            logger.debug("No access grants found for user [{}]", username);
            return false;
        }
    }

    private boolean namespaceMatches(UserAccess grant, String namespace) {
        return grant.getNamespace().equals(namespace);
    }

    private boolean permissionSufficient(UserAccess grant, UserAction action) {
        return switch (grant.getPermission()) {
            case read -> action == UserAction.READ;
            case write -> action == UserAction.READ || action == UserAction.WRITE;
            case admin -> true;
        };
    }
}
