package org.finos.calm.security;

import io.quarkus.arc.profile.IfBuildProfile;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;

@ApplicationScoped
@Provider
@Priority(1)
@IfBuildProfile("proxy")
public class ProxyAccessControlFilter implements ContainerRequestFilter {

    private final ResourceInfo resourceInfo;
    private final UserAccessValidator userAccessValidator;
    private final String usernameHeader;
    private final Logger logger = LoggerFactory.getLogger(ProxyAccessControlFilter.class);

    public ProxyAccessControlFilter(ResourceInfo resourceInfo,
                                    UserAccessValidator userAccessValidator,
                                    @ConfigProperty(name = "calm.security.proxy.username-header", defaultValue = "Proxy-Remote-User") String usernameHeader) {
        this.resourceInfo = resourceInfo;
        this.userAccessValidator = userAccessValidator;
        this.usernameHeader = usernameHeader;
    }

    @Override
    public void filter(ContainerRequestContext requestContext) {
        PermittedScopes annotation = resourceInfo.getResourceMethod().getAnnotation(PermittedScopes.class);
        if (Objects.isNull(annotation)) {
            logger.warn("Unsecured endpoint accessed: {}", resourceInfo.getResourceMethod());
            return;
        }

        String username = requestContext.getHeaderString(usernameHeader);
        if (username == null || username.isBlank()) {
            logger.warn("Request rejected: {} header is missing or blank", usernameHeader);
            requestContext.abortWith(Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Unauthorized: " + usernameHeader + " header is required")
                    .build());
            return;
        }

        String requestMethod = requestContext.getMethod();
        String path = requestContext.getUriInfo().getPath();
        String namespace = requestContext.getUriInfo().getPathParameters().getFirst("namespace");

        UserRequestAttributes userRequestAttributes = new UserRequestAttributes(requestMethod, username, path, namespace);
        logger.debug("User request attributes: {}", userRequestAttributes);

        if (!userAccessValidator.isUserAuthorized(userRequestAttributes)) {
            logger.warn("No access permissions assigned to the user: [{}]", username);
            requestContext.abortWith(Response.status(Response.Status.FORBIDDEN)
                    .entity("Forbidden: user does not have required access grants")
                    .build());
        }
    }
}
