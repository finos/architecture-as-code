package org.finos.calm.security;


import io.quarkus.arc.profile.IfBuildProfile;
import io.quarkus.runtime.util.StringUtil;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Objects;


/**
 * This filter is responsible for validating incoming JWT tokens and enforcing access control rules
 * based on OAuth 2.0 authorization flows and RBAC (Role-Based Access Control).
 *
 * The Resource Server supports:
 * 1. **Authorization Code Flow / Device Code Flow (End-User Authentication)**
 *    - Tokens issued for an authenticated user **must undergo additional RBAC checks**
 *      to ensure the user has the necessary permissions.
 *    - OAuth scopes provide high-level access control, but **RBAC is required for fine-grained permissions**.
 *
 * 🔹 **TODO: Implement RBAC checks to enforce role-based access control on top of scopes.**
 *
 * Why RBAC?
 * - Scopes define **what** actions a user can perform but do not control **who** can perform them.
 * - RBAC ensures that even if a user has a valid scope, their role (e.g., Admin, Viewer)
 *   dictates whether they can execute the request.
 *
 * This filter currently validates JWT tokens and scopes. **RBAC enforcement is a pending task.**
 */
@ApplicationScoped
@Provider
@Priority(1)
@IfBuildProfile("secure")
public class AccessControlFilter implements ContainerRequestFilter {

    private final JsonWebToken jwt;
    private final ResourceInfo resourceInfo;
    private final Logger logger = LoggerFactory.getLogger(AccessControlFilter.class);

    public AccessControlFilter(JsonWebToken jwt, ResourceInfo resourceInfo) {
        this.jwt = jwt;
        this.resourceInfo = resourceInfo;
    }

    @Override
    public void filter(ContainerRequestContext requestContext) {
        PermittedScopes annotation = resourceInfo.getResourceMethod().getAnnotation(PermittedScopes.class);
        if (Objects.isNull(annotation)) {
            logger.warn("Unsecured endpoint accessed: {}", resourceInfo.getResourceMethod());
            return;
        }

        String[] requiredScopes = annotation.value();
        String tokenScopes = jwt.getClaim("scope");

        if (StringUtil.isNullOrEmpty(tokenScopes) || !hasRequiredScope(tokenScopes, requiredScopes)) {
            requestContext.abortWith(Response.status(Response.Status.FORBIDDEN)
                    .entity("Forbidden: JWT does not have required scopes.")
                    .build());
        }
    }

    /**
     * Check if the JWT token has at least one of the required scopes.
     *
     * @param tokenScopes    The scopes in the JWT token.
     * @param requiredScopes The scopes required for the resource.
     * @return true if the token contains one of the required scopes, false otherwise.
     */
    private boolean hasRequiredScope(String tokenScopes, String[] requiredScopes) {
        List<String> requiredScopesList = List.of(requiredScopes);
        boolean hasMatch = requiredScopesList.stream()
                .anyMatch(tokenScopes::contains);

        if (hasMatch) {
            logger.info("Request allowed, PermittedScopes are: {}, there is a matching scope found in accessToken: [{}]", requiredScopes, tokenScopes);
        } else {
            logger.error("Request denied, PermittedScopes are: {}, no matching scopes found in accessToken: [{}]", requiredScopes, tokenScopes);
        }
        return hasMatch;
    }
}