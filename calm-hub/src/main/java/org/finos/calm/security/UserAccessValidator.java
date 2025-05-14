package org.finos.calm.security;

import io.netty.util.internal.StringUtil;
import io.quarkus.arc.profile.IfBuildProfile;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.ForbiddenException;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@ApplicationScoped
@IfBuildProfile("secure")
public class UserAccessValidator {

    private static final Logger log = LoggerFactory.getLogger(UserAccessValidator.class);
    private final UserAccessStore userAccessStore;

    public UserAccessValidator(UserAccessStore userAccessStore) {
        this.userAccessStore = userAccessStore;
    }

    public void validate(UserRequestAttributes userRequestAttributes) {

        String action = mapHttpMethodToPermission(userRequestAttributes.requestMethod());
        String requestPath = userRequestAttributes.path();
        try {
            List<UserAccess> userAccesses = userAccessStore.getUserAccessForUsername(userRequestAttributes.username());

            boolean authorized = userAccesses.stream().anyMatch(userAccess -> {
                boolean resourceMatches = (UserAccess.ResourceType.all == userAccess.getResourceType())
                        || requestPath.contains(userAccess.getResourceType().name());
                boolean permissionSufficient = permissionAllows(userAccess.getPermission(), action);
                boolean namespaceMatches = !StringUtil.isNullOrEmpty(userRequestAttributes.namespace()) && userRequestAttributes.namespace().equals(userAccess.getNamespace());
                return resourceMatches && permissionSufficient && namespaceMatches;
            });

            if (!authorized && !isDefaultAccessibleResource(userRequestAttributes)) {
                log.warn("Access denied for user [{}] to path [{}] with action [{}]", userRequestAttributes.username(),
                        userRequestAttributes.path(),
                        action);
                throw new ForbiddenException("Access denied.");
            }

        } catch (NamespaceNotFoundException | UserAccessNotFoundException e) {
            log.error("Access check failed for user [{}]", userRequestAttributes.username(), e.getMessage());
            throw new ForbiddenException("Access denied.");
        }
    }

    private boolean isDefaultAccessibleResource(UserRequestAttributes userRequestAttributes) {
        return "/calm/namespaces".equals(userRequestAttributes.path()) &&
                "get".equalsIgnoreCase(userRequestAttributes.requestMethod().toLowerCase());
    }

    private String mapHttpMethodToPermission(String method) {
        return switch (method) {
            case "POST", "PUT", "PATCH", "DELETE" -> "write";
            default -> "read";
        };
    }

    private boolean permissionAllows(UserAccess.Permission userPermission, String requestedAction) {
        return switch (userPermission) {
            case write -> requestedAction.equals("write") || requestedAction.equals("read");
            case read -> requestedAction.equals("read");
        };
    }
}
