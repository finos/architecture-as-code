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
 * A filter that checks if the JWT contains one of the required scopes specified in the @ScopesAllowed annotation.
 */
@ApplicationScoped
@Provider
@Priority(1)
@IfBuildProfile("secure")
public class ScopesAllowedFilter implements ContainerRequestFilter {

    private final JsonWebToken jwt;
    private final ResourceInfo resourceInfo;
    private final Logger logger = LoggerFactory.getLogger(ScopesAllowedFilter.class);

    public ScopesAllowedFilter(JsonWebToken jwt, ResourceInfo resourceInfo) {
        this.jwt = jwt;
        this.resourceInfo = resourceInfo;
    }

    @Override
    public void filter(ContainerRequestContext requestContext) {
        ScopesAllowed annotation = resourceInfo.getResourceMethod().getAnnotation(ScopesAllowed.class);
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
            logger.info("Request allowed, ScopesAllowed are: {}, there is a matching scope found in accessToken: {}", requiredScopes, tokenScopes);
        } else {
            logger.error("Request denied, ScopesAllowed are: {}, no matching scopes found in accessToken: {}", requiredScopes, tokenScopes);
        }
        return hasMatch;
    }
}

