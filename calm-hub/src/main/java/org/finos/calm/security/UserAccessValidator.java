package org.finos.calm.security;

import io.netty.util.internal.StringUtil;
import io.quarkus.arc.profile.IfBuildProfile;
import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Validates whether a user is authorized to access a particular resource based on
 * their assigned permissions and namespaces.
 *
 * This validator is active only when the 'secure' profile is enabled.
 */
@ApplicationScoped
@IfBuildProfile("secure")
public class UserAccessValidator {

    private static final Logger logger = LoggerFactory.getLogger(UserAccessValidator.class);

    private static final String READ_ACTION = "read";
    private static final String WRITE_ACTION = "write";

    private final UserAccessStore userAccessStore;

    /**
     * Constructs a new UserAccessValidator with the provided UserAccessStore.
     *
     * @param userAccessStore the store used to retrieve user access permissions
     */
    public UserAccessValidator(UserAccessStore userAccessStore) {
        this.userAccessStore = userAccessStore;
    }

    /**
     * Determines whether the user is authorized to perform an action based on their request attributes.
     *
     * <p>If the user does not have any access entries or an exception is thrown during validation,
     * access is denied and the method returns {@code false}.
     *
     * @param userRequestAttributes encapsulates the HTTP method, username, resource path, and namespace
     * @return {@code true} if the user is authorized to perform the action; {@code false} otherwise
     */
    public boolean isUserAuthorized(UserRequestAttributes userRequestAttributes) {
        String action = mapHttpMethodToPermission(userRequestAttributes.requestMethod());
        if (isDefaultAccessibleResource(userRequestAttributes)) {
            logger.debug("The GET /calm/namespaces endpoint is accessible by default to all authenticated users");
            return true;
        }
        try {
            return hasAccessForActionOnResource(userRequestAttributes, action);
        } catch (UserAccessNotFoundException ex) {
            logger.error("No access permissions assigned to the user: [{}]", userRequestAttributes.username(), ex);
            return false;
        }
    }

    /**
     * Determines whether the user has sufficient access to perform the specified action
     * on a resource, based on the user's access grants, request path, and namespace.
     *
     * @param requestAttributes the user request attributes, including username, request path, and namespace
     * @param action            the action the user is attempting to perform (e.g., "read", "write".)
     * @return true if the user has valid access for the action on the requested resource, false otherwise
     * @throws UserAccessNotFoundException if the user has no associated access records in the system
     */
    private boolean hasAccessForActionOnResource(UserRequestAttributes requestAttributes, String action) throws UserAccessNotFoundException {
        List<UserAccess> userAccesses = userAccessStore.getUserAccessForUsername(requestAttributes.username());
        return userAccesses.stream().anyMatch(userAccess -> {
            boolean resourceMatches = (UserAccess.ResourceType.all == userAccess.getResourceType())
                    || requestAttributes.path().contains(userAccess.getResourceType().name());
            boolean permissionSufficient = permissionAllows(userAccess.getPermission(), action);
            boolean namespaceMatches = !StringUtil.isNullOrEmpty(requestAttributes.namespace())
                    && requestAttributes.namespace().equals(userAccess.getNamespace());
            return resourceMatches && permissionSufficient && namespaceMatches;
        });
    }

    /**
     * Checks whether the request targets the default-accessible endpoint.
     *
     * @param userRequestAttributes the attributes of the incoming user request
     * @return true if the endpoint is accessible by default, false otherwise
     */
    private boolean isDefaultAccessibleResource(UserRequestAttributes userRequestAttributes) {
        //TODO: How to protect GET - /calm/namespaces endpoint, by maintaining namespace specific user grants.
        return "/calm/namespaces".equals(userRequestAttributes.path()) &&
                "get".equalsIgnoreCase(userRequestAttributes.requestMethod().toLowerCase());
    }

    /**
     * Maps HTTP methods to access permissions.
     *
     * @param method the HTTP method
     * @return "write" for modifying methods, "read" otherwise
     */
    private String mapHttpMethodToPermission(String method) {
        return switch (method) {
            case "POST", "PUT", "PATCH", "DELETE" -> WRITE_ACTION;
            default -> READ_ACTION;
        };
    }

    /**
     * Checks whether the user's permission level allows the requested action.
     *
     * @param userPermission  the user's assigned permission
     * @param requestedAction the action the user is attempting to perform
     * @return true if the permission is sufficient, false otherwise
     */
    private boolean permissionAllows(UserAccess.Permission userPermission, String requestedAction) {
        return switch (userPermission) {
            case write -> WRITE_ACTION.equals(requestedAction) || READ_ACTION.equals(requestedAction);
            case read -> READ_ACTION.equals(requestedAction);
        };
    }
}