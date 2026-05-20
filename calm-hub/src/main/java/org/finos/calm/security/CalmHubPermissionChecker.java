package org.finos.calm.security;

import io.netty.util.internal.StringUtil;
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

    // TODO remaining checkers + examine scopes needed.

    @PermissionChecker("architectures:read")
    public boolean allowArchitectureRead(SecurityIdentity securityIdentity, String namespace) {
        // TODO it seems we either need this or a config prop to turn this on or off.
        if (securityIdentity.isAnonymous()) return true;
        return isUserEntitled(securityIdentity, namespace, ResourceType.ARCHITECTURE, UserAction.READ);
    }

    @PermissionChecker("architectures:write")
    public boolean allowArchitectureWrite(SecurityIdentity securityIdentity, String namespace) {
        if (securityIdentity.isAnonymous()) return true;
        return isUserEntitled(securityIdentity, namespace, ResourceType.ARCHITECTURE, UserAction.WRITE);
    }

    // TODO do resource types affect things? Are entitlements different by resource type?
    // TODO option to default-allow READ access
    public boolean isUserEntitled(SecurityIdentity securityIdentity,
                                  String namespace,
                                  ResourceType resourceType,
                                  UserAction action) {
        if (StringUtil.isNullOrEmpty(namespace)) {
            logger.error("Missing namespace when checking entitlements.");
            throw new IllegalStateException("Permission checker expects 'namespace' String argument on annotated method, potentially misconfigured endpoint.");
        }
        String username = securityIdentity.getPrincipal().getName();
        logger.debug("Validating whether user [{}] has entitlement [{}] on namespace [{}]", username, action, namespace);

        List<UserAccess> userAccesses;
        try {
            userAccesses = userAccessStore.getUserAccessForUsername(username);
        } catch (UserAccessNotFoundException e) {
            logger.error("Error while retrieving user entitlements for user {}", username, e);
            throw new RuntimeException(e);
        }
        boolean result = userAccesses.stream().anyMatch(userAccess -> {
            boolean namespaceMatches = namespace.equals(userAccess.getNamespace());
            boolean permissionSufficient = permissionAllows(userAccess.getPermission(), action);
            return namespaceMatches && permissionSufficient;
        });
        if (result) {
            logger.info("User {} AUTHORIZED to perform action {} on resource of type {} in namespace {}", username, action, resourceType, namespace);
        } else {
            logger.warn("User {} DENIED to perform action {} on resource of type {} in namespace {}", username, action, resourceType, namespace);
        }
        return result;
    }

    /**
     * Checks whether the user's permission level allows the requested action.
     *
     * @param userPermission  the user's assigned permission
     * @param requestedAction the action the user is attempting to perform
     * @return true if the permission is sufficient, false otherwise
     */
    private boolean permissionAllows(UserAccess.Permission userPermission, UserAction requestedAction) {
        return switch(userPermission) {
            case read -> requestedAction == UserAction.READ;
            case write -> requestedAction == UserAction.READ || requestedAction == UserAction.WRITE;
            case admin -> true;
        };
    }
}
