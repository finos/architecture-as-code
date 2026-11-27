package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.extensions.ExtensionFormInputException;
import org.finos.calm.extensions.ExtensionFormService;
import org.finos.calm.extensions.ExtensionProxyException;
import org.finos.calm.extensions.ExtensionProxyResponse;

import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

/**
 * Submits the input of an extension form (ADR 0013). Each reply says in {@value #DISPATCH} whether Hub sent the call to
 * the backend, so that the UI can tell a failure from an unknown outcome. Hub sets it after the backend replies, and the
 * proxy passes on no backend header of that name, so a backend cannot set it.
 */
@Tag(name = "Extensions", description = "Extensions that the operator enabled on this CALM Hub")
@Path("/api/calm/extensions/{id}/forms")
@Authenticated
@Produces(MediaType.WILDCARD)
public class ExtensionFormResource {

    /** {@code not-sent}: Hub refused the call. {@code sent}: the reply is the backend's. {@code unknown}: the backend may have acted. */
    public static final String DISPATCH = "Calm-Extension-Dispatch";

    private final ExtensionFormService service;
    private final SecurityIdentity identity;
    private final boolean captureSourceIp;

    @Inject
    public ExtensionFormResource(ExtensionFormService service, SecurityIdentity identity, Config properties) {
        this.service = service;
        this.identity = identity;
        this.captureSourceIp = properties.getOptionalValue("calm.audit.capture-source-ip", Boolean.class).orElse(false);
    }

    @POST
    @Path("{form}")
    @Operation(summary = "Submit an extension form",
            description = "Checks the target and the input against the form in the manifest, then calls the form route "
                    + "with {submission, context, input}. The reply has a Calm-Extension-Dispatch header: not-sent, "
                    + "sent or unknown. A 422 reply has a message for each field in fields.")
    public Response submit(@PathParam("id") String id, @PathParam("form") String form, @Context HttpHeaders headers,
                           InputStream body) {
        try {
            ExtensionProxyResponse reply = service.submit(identity, id, form, headers.getHeaderString(HttpHeaders.CONTENT_TYPE),
                    headers.getHeaderString(HttpHeaders.ACCEPT_LANGUAGE),
                    captureSourceIp ? headers.getHeaderString("X-Forwarded-For") : null, body);
            Response.ResponseBuilder builder = Response.status(reply.status())
                    .entity(reply.body().length == 0 ? null : reply.body());
            reply.headers().forEach(builder::header);
            return builder.header(DISPATCH, "sent")
                    .header("Content-Security-Policy", ExtensionProxyResource.CONTENT_SECURITY_POLICY)
                    .build();
        } catch (ExtensionProxyException e) {
            Map<String, Object> entity = new LinkedHashMap<>();
            entity.put("error", e.getMessage());
            if (e instanceof ExtensionFormInputException input) {
                Map<String, String> fields = new TreeMap<>(input.fields());
                String whole = fields.remove("");
                if (whole != null) {
                    entity.put("error", whole);
                }
                entity.put("fields", fields);
            }
            Response.ResponseBuilder builder = Response.status(e.status());
            e.headers().forEach(builder::header);
            // The proxy fails with 502 or 504 only after it sent the call: the backend may have acted on it.
            boolean unknown = e.status() == 502 || e.status() == 504;
            return builder.type(MediaType.APPLICATION_JSON)
                    .entity(entity)
                    .header(DISPATCH, unknown ? "unknown" : "not-sent")
                    .header("Cache-Control", "private")
                    .header("Content-Security-Policy", ExtensionProxyResource.CONTENT_SECURITY_POLICY)
                    .build();
        }
    }
}
