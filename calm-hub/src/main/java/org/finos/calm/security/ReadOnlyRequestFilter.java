package org.finos.calm.security;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.config.ConfigProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Set;

/**
 * When {@code calm.readonly=true} this filter intercepts every request on the
 * {@code /calm/*} and {@code /api/calm/*} paths and rejects any mutating HTTP
 * method (POST, PUT, DELETE, PATCH) with {@code 405 Method Not Allowed}.
 * Read-only methods (GET, HEAD, OPTIONS) are passed through unchanged.
 *
 * <p>This filter runs at priority 0 (before {@link AccessControlFilter} at
 * priority 1) so read-only violations are rejected before auth checks.
 *
 * <p>{@code @PreMatching} makes the filter run before JAX-RS resource matching.
 * Without it, {@code ContainerRequestFilter} runs after the router has tried to
 * locate a resource, so an unmatched mutating verb (e.g. {@code DELETE
 * /calm/namespaces/finos} when no DELETE handler exists) would return 404
 * before this filter could see the request.  Pre-matching guarantees every
 * inbound {@code /calm/*} request is intercepted and returns 405 in read-only
 * mode regardless of whether a backing resource method exists.
 */
@ApplicationScoped
@Provider
@PreMatching
@Priority(0)
public class ReadOnlyRequestFilter implements ContainerRequestFilter {

    private static final Logger LOG = LoggerFactory.getLogger(ReadOnlyRequestFilter.class);

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "DELETE", "PATCH");
    private static final String CALM_PATH_PREFIX = "/calm/";
    private static final String API_CALM_PATH_PREFIX = "/api/calm/";
    private static final String ALLOW_HEADER = "Allow";
    private static final String ALLOWED_METHODS = "GET, HEAD, OPTIONS";

    // Resolved once at runtime startup via @PostConstruct (see init()).  We deliberately
    // avoid @ConfigProperty here: in native image, @ConfigProperty values on CDI beans
    // are captured during static initialisation at build time, which bakes in the build
    // default (false) and ignores CALM_READONLY at runtime.  Reading from ConfigProvider
    // in @PostConstruct happens in the runtime phase, after env vars are loaded.
    // Package-private so unit tests can override the resolved value.
    boolean readOnly;

    @PostConstruct
    void init() {
        readOnly = ConfigProvider.getConfig()
                .getOptionalValue("calm.readonly", Boolean.class)
                .orElse(false);
    }

    @Override
    public void filter(ContainerRequestContext requestContext) {
        if (!readOnly) {
            return;
        }

        // UriInfo#getPath() in RESTEasy may or may not include a leading slash;
        // normalise so the prefix check is reliable in all deployments.
        String rawPath = requestContext.getUriInfo().getPath();
        String path = rawPath.startsWith("/") ? rawPath : "/" + rawPath;
        boolean onCalmPath = path.startsWith(CALM_PATH_PREFIX) || path.equals("/calm")
                || path.startsWith(API_CALM_PATH_PREFIX) || path.equals("/api/calm");
        if (!onCalmPath) {
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
