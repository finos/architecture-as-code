package org.finos.calm.security;

import io.quarkus.security.PermissionChecker;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@ApplicationScoped
public class CalmHubPermissionChecker {
    private static final Logger logger = LoggerFactory.getLogger(CalmHubPermissionChecker.class);

    private final UserAccessStore userAccessStore;

    public CalmHubPermissionChecker(UserAccessStore userAccessStore) {
        this.userAccessStore = userAccessStore;
    }

    @PermissionChecker(CalmHubScopes.ARCHITECTURES_READ)
    public boolean allowArchitectureRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasReadRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.architectures, false);
    }

    @PermissionChecker(CalmHubScopes.ARCHITECTURES_WRITE)
    public boolean allowArchitectureWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasWriteRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.architectures, true);
    }

    @PermissionChecker(CalmHubScopes.PATTERNS_READ)
    public boolean allowPatternRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasReadRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.patterns, false);
    }

    @PermissionChecker(CalmHubScopes.PATTERNS_WRITE)
    public boolean allowPatternWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasWriteRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.patterns, true);
    }

    @PermissionChecker(CalmHubScopes.FLOWS_READ)
    public boolean allowFlowRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasReadRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.flows, false);
    }

    @PermissionChecker(CalmHubScopes.FLOWS_WRITE)
    public boolean allowFlowWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasWriteRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.flows, true);
    }

    @PermissionChecker(CalmHubScopes.ADRS_READ)
    public boolean allowAdrRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasReadRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.adrs, false);
    }

    @PermissionChecker(CalmHubScopes.ADRS_WRITE)
    public boolean allowAdrWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasWriteRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.adrs, true);
    }

    @PermissionChecker(CalmHubScopes.INTERFACES_READ)
    public boolean allowInterfaceRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasReadRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.all, false);
    }

    @PermissionChecker(CalmHubScopes.INTERFACES_WRITE)
    public boolean allowInterfaceWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasWriteRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.all, true);
    }

    @PermissionChecker(CalmHubScopes.STANDARDS_READ)
    public boolean allowStandardRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasReadRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.all, false);
    }

    @PermissionChecker(CalmHubScopes.STANDARDS_WRITE)
    public boolean allowStandardWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (hasWriteRole(identity)) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.all, true);
    }

    @PermissionChecker(CalmHubScopes.NAMESPACE_ADMIN)
    public boolean allowNamespaceAdmin(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        if (identity.hasRole(CalmHubScopes.ROLE_ADMIN)) return true;
        String username = identity.getPrincipal().getName();
        try {
            return userAccessStore.getUserAccessForUsername(username).stream()
                    .anyMatch(grant -> grant.getNamespace().equals(namespace)
                            && grant.getPermission() == UserAccess.Permission.admin);
        } catch (UserAccessNotFoundException e) {
            logger.error("No user access records found for user {}. Rejecting request.", username);
            throw new RuntimeException(e);
        }
    }

    @PermissionChecker(CalmHubScopes.ROLE_VIEWER)
    public boolean checkViewerRole(SecurityIdentity identity) {
        return identity.isAnonymous() || hasReadRole(identity);
    }

    @PermissionChecker(CalmHubScopes.ROLE_CONTRIBUTOR)
    public boolean checkContributorRole(SecurityIdentity identity) {
        return identity.isAnonymous() || hasWriteRole(identity);
    }

    @PermissionChecker(CalmHubScopes.ROLE_ADMIN)
    public boolean checkAdminRole(SecurityIdentity identity) {
        return identity.isAnonymous() || identity.hasRole(CalmHubScopes.ROLE_ADMIN);
    }

    private boolean hasReadRole(SecurityIdentity identity) {
        return identity.hasRole(CalmHubScopes.ROLE_VIEWER)
                || identity.hasRole(CalmHubScopes.ROLE_CONTRIBUTOR)
                || identity.hasRole(CalmHubScopes.ROLE_ADMIN);
    }

    private boolean hasWriteRole(SecurityIdentity identity) {
        return identity.hasRole(CalmHubScopes.ROLE_CONTRIBUTOR)
                || identity.hasRole(CalmHubScopes.ROLE_ADMIN);
    }

    private boolean hasAccess(SecurityIdentity identity, String namespace,
                              UserAccess.ResourceType resourceType, boolean requireWrite) {
        String username = identity.getPrincipal().getName();
        logger.debug("Checking access for user [{}] on namespace [{}] resource [{}] write=[{}]",
                username, namespace, resourceType, requireWrite);
        try {
            boolean result = userAccessStore.getUserAccessForUsername(username).stream()
                    .anyMatch(grant -> namespaceMatches(grant, namespace)
                            && resourceMatches(grant, resourceType)
                            && permissionSufficient(grant, requireWrite));
            if (result) {
                logger.info("User [{}] AUTHORIZED for [{}] on [{}] in namespace [{}]",
                        username, requireWrite ? "write" : "read", resourceType, namespace);
            } else {
                logger.warn("User [{}] DENIED for [{}] on [{}] in namespace [{}]",
                        username, requireWrite ? "write" : "read", resourceType, namespace);
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

    private boolean resourceMatches(UserAccess grant, UserAccess.ResourceType required) {
        return grant.getResourceType() == UserAccess.ResourceType.all
                || grant.getResourceType() == required;
    }

    private boolean permissionSufficient(UserAccess grant, boolean requireWrite) {
        return switch (grant.getPermission()) {
            case read -> !requireWrite;
            case write, admin -> true;
        };
    }
}
