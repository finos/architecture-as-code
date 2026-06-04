package org.finos.calm.security;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Set;

/**
 * When {@code calm.readonly=true} this filter intercepts every request on the
 * {@code /calm/*} path and rejects any mutating HTTP method (POST, PUT, DELETE,
 * PATCH) with {@code 405 Method Not Allowed}.  Read-only methods (GET, HEAD,
 * OPTIONS) are passed through unchanged.
 *
 * <p>This filter runs at priority 0 (before {@link AccessControlFilter} at
 * priority 1) so read-only violations are rejected before auth checks.
 */
@ApplicationScoped
@Provider
@Priority(0)
public class ReadOnlyRequestFilter implements ContainerRequestFilter {

    private static final Logger LOG = LoggerFactory.getLogger(ReadOnlyRequestFilter.class);

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "DELETE", "PATCH");
    private static final String CALM_PATH_PREFIX = "/calm/";
    private static final String ALLOW_HEADER = "Allow";
    private static final String ALLOWED_METHODS = "GET, HEAD, OPTIONS";

    @ConfigProperty(name = "calm.readonly", defaultValue = "false")
    boolean readOnly;

    @Override
    public void filter(ContainerRequestContext requestContext) {
        if (!readOnly) {
            return;
        }

        String path = requestContext.getUriInfo().getPath();
        if (!path.startsWith(CALM_PATH_PREFIX) && !path.equals("/calm")) {
            return;
        }

        String method = requestContext.getMethod();
        if (MUTATING_METHODS.contains(method)) {
            LOG.warn("Read-only mode: rejected {} {}", method, path);
            requestContext.abortWith(
                    Response.status(Response.Status.METHOD_NOT_ALLOWED)
                            .header(ALLOW_HEADER, ALLOWED_METHODS)
                            .entity("This CALM Hub instance is read-only.")
                            .build());
        }
    }
}
