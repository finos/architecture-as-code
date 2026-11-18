package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.extensions.ExtensionPaths;
import org.finos.calm.extensions.ExtensionProxyException;
import org.finos.calm.extensions.ExtensionProxyRequest;
import org.finos.calm.extensions.ExtensionProxyResponse;
import org.finos.calm.extensions.ExtensionProxyService;

import java.io.InputStream;
import java.util.Map;

/**
 * Proxies the routes that an extension manifest declares (ADRs 0009 and 0011). The rules are in
 * {@link ExtensionProxyService}, which the MCP tools use too.
 */
@Tag(name = "Extensions", description = "Extensions that the operator enabled on this CALM Hub")
@Path("/api/calm/extensions/{id}/api")
@Authenticated
// Any Accept, such as text/event-stream: the service checks the reply type.
@Produces(MediaType.WILDCARD)
public class ExtensionProxyResource {

    /** An extension cannot serve a page or a script that runs in Hub's origin. */
    static final String CONTENT_SECURITY_POLICY = "sandbox; default-src 'none'";
    private static final String DESCRIPTION = "Sends the call to the extension backend, if the extension declares "
            + "the route and the caller has its scope. The backend gets a CALM Hub identity assertion, never the "
            + "caller's credentials.";

    private final ExtensionProxyService service;
    private final SecurityIdentity identity;
    private final boolean captureSourceIp;

    @Inject
    public ExtensionProxyResource(ExtensionProxyService service, SecurityIdentity identity, Config properties) {
        this.service = service;
        this.identity = identity;
        // Read at run time, as AuditRequestFilter does.
        this.captureSourceIp = properties.getOptionalValue("calm.audit.capture-source-ip", Boolean.class).orElse(false);
    }

    @GET
    @Path("{path: .*}")
    @Operation(summary = "Call a GET route of an extension", description = DESCRIPTION)
    public Response get(@PathParam("id") String id, @Context UriInfo uriInfo, @Context HttpHeaders headers) {
        return proxy("GET", id, uriInfo, headers, null);
    }

    @POST
    @Path("{path: .*}")
    @Operation(summary = "Call a POST route of an extension", description = DESCRIPTION)
    public Response post(@PathParam("id") String id, @Context UriInfo uriInfo, @Context HttpHeaders headers,
                         InputStream body) {
        return proxy("POST", id, uriInfo, headers, body);
    }

    @PUT
    @Path("{path: .*}")
    @Operation(summary = "Call a PUT route of an extension", description = DESCRIPTION)
    public Response put(@PathParam("id") String id, @Context UriInfo uriInfo, @Context HttpHeaders headers,
                        InputStream body) {
        return proxy("PUT", id, uriInfo, headers, body);
    }

    @PATCH
    @Path("{path: .*}")
    @Operation(summary = "Call a PATCH route of an extension", description = DESCRIPTION)
    public Response patch(@PathParam("id") String id, @Context UriInfo uriInfo, @Context HttpHeaders headers,
                          InputStream body) {
        return proxy("PATCH", id, uriInfo, headers, body);
    }

    @DELETE
    @Path("{path: .*}")
    @Operation(summary = "Call a DELETE route of an extension", description = DESCRIPTION)
    public Response delete(@PathParam("id") String id, @Context UriInfo uriInfo, @Context HttpHeaders headers,
                           InputStream body) {
        return proxy("DELETE", id, uriInfo, headers, body);
    }

    private Response proxy(String method, String id, UriInfo uriInfo, HttpHeaders headers, InputStream body) {
        // The raw, still-encoded path, so that the service sees any encoded dot or slash.
        String path = "/" + uriInfo.getPathParameters(false).getFirst("path");
        ExtensionProxyRequest request = new ExtensionProxyRequest(id, method, path, uriInfo.getRequestUri().getRawQuery(),
                headers.getHeaderString(HttpHeaders.CONTENT_TYPE), headers.getHeaderString(HttpHeaders.ACCEPT),
                headers.getHeaderString(HttpHeaders.ACCEPT_LANGUAGE), headers.getHeaderString(HttpHeaders.IF_MATCH),
                headers.getHeaderString(HttpHeaders.IF_NONE_MATCH),
                captureSourceIp ? headers.getHeaderString("X-Forwarded-For") : null, body);
        try {
            // JAX-RS can drop a matrix parameter from the path parameter, so Hub refuses it here and does not drop it.
            if (uriInfo.getRequestUri().getRawPath().indexOf(';') >= 0) {
                throw new ExtensionProxyException(400, ExtensionPaths.NOT_ALLOWED);
            }
            ExtensionProxyResponse reply = service.call(identity, request);
            Response.ResponseBuilder builder = Response.status(reply.status())
                    .entity(reply.body().length == 0 ? null : reply.body());
            reply.headers().forEach(builder::header);
            return builder.header("Content-Security-Policy", CONTENT_SECURITY_POLICY).build();
        } catch (ExtensionProxyException e) {
            Response.ResponseBuilder builder = Response.status(e.status());
            e.headers().forEach(builder::header);
            return builder.type(MediaType.APPLICATION_JSON)
                    .entity(Map.of("error", e.getMessage()))
                    .header("Cache-Control", "private")
                    .header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
                    .build();
        }
    }
}
