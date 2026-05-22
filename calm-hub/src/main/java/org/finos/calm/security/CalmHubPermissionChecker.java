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

    @PermissionChecker("architectures-read")
    public boolean allowArchitectureRead(SecurityIdentity identity, String namespace) {
        logger.warn("checking arch read permissions");
        return true;
//        if (identity.isAnonymous()) return true;
//        return hasAccess(identity, namespace, UserAccess.ResourceType.architectures, false);
    }

    @PermissionChecker("architectures-write")
    public boolean allowArchitectureWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.architectures, true);
    }

    @PermissionChecker("patterns-read")
    public boolean allowPatternRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.patterns, false);
    }

    @PermissionChecker("patterns-write")
    public boolean allowPatternWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.patterns, true);
    }

    @PermissionChecker("flows-read")
    public boolean allowFlowRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.flows, false);
    }

    @PermissionChecker("flows-write")
    public boolean allowFlowWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.flows, true);
    }

    @PermissionChecker("adrs-read")
    public boolean allowAdrRead(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.adrs, false);
    }

    @PermissionChecker("adrs-write")
    public boolean allowAdrWrite(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
        return hasAccess(identity, namespace, UserAccess.ResourceType.adrs, true);
    }

    @PermissionChecker("namespace-admin")
    public boolean allowNamespaceAdmin(SecurityIdentity identity, String namespace) {
        if (identity.isAnonymous()) return true;
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
