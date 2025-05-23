package org.finos.calm.security;

import io.netty.util.internal.StringUtil;
import io.quarkus.arc.profile.IfBuildProfile;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.ForbiddenException;
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

    private static final Logger log = LoggerFactory.getLogger(UserAccessValidator.class);
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
     * Validates whether a user has sufficient access rights to perform an action on a given resource.
     * If validation fails, a {@link ForbiddenException} is thrown.
     *
     * @param userRequestAttributes the request attributes including username, HTTP method, namespace, and path
     * @throws ForbiddenException if the user is not authorized
     */
    public void validate(UserRequestAttributes userRequestAttributes) {
        String action = mapHttpMethodToPermission(userRequestAttributes.requestMethod());
        String requestPath = userRequestAttributes.path();

        if (isDefaultAccessibleResource(userRequestAttributes)) {
            log.info("The GET /calm/namespaces endpoint is accessible by default to all authenticated users");
            return;
        }

        try {
            List<UserAccess> userAccesses = userAccessStore.getUserAccessForUsername(userRequestAttributes.username());

            boolean authorized = userAccesses.stream().anyMatch(userAccess -> {
                boolean resourceMatches = (UserAccess.ResourceType.all == userAccess.getResourceType())
                        || requestPath.contains(userAccess.getResourceType().name());
                boolean permissionSufficient = permissionAllows(userAccess.getPermission(), action);
                boolean namespaceMatches = !StringUtil.isNullOrEmpty(userRequestAttributes.namespace())
                        && userRequestAttributes.namespace().equals(userAccess.getNamespace());
                return resourceMatches && permissionSufficient && namespaceMatches;
            });

            if (!authorized) {
                log.warn("Access denied for user [{}] to path [{}] with action [{}]",
                        userRequestAttributes.username(), userRequestAttributes.path(), action);
                throw new ForbiddenException("Access denied.");
            }

        } catch (UserAccessNotFoundException ex) {
            log.error("No access permissions assigned to the user: [{}]", userRequestAttributes.username(), ex);
            throw new ForbiddenException("Access denied.");
        }
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
            case "POST", "PUT", "PATCH", "DELETE" -> "write";
            default -> "read";
        };
    }

    /**
     * Checks whether the user's permission level allows the requested action.
     *
     * @param userPermission   the user's assigned permission
     * @param requestedAction  the action the user is attempting to perform
     * @return true if the permission is sufficient, false otherwise
     */
    private boolean permissionAllows(UserAccess.Permission userPermission, String requestedAction) {
        return switch (userPermission) {
            case write -> requestedAction.equals("write") || requestedAction.equals("read");
            case read -> requestedAction.equals("read");
        };
    }
}