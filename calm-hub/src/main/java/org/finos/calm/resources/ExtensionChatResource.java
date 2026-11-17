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
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.extensions.ExtensionProxyException;
import org.finos.calm.extensions.ExtensionProxyService;

import java.io.InputStream;

/**
 * Sends a message to the chat of an extension and streams the reply. The route of a {@code chat} entry answers only
 * here, so that Hub always checks the message, the shared context and the citations (hubApi 0 chat contract).
 */
@Tag(name = "Extensions", description = "Extensions that the operator enabled on this CALM Hub")
@Path("/api/calm/extensions/{id}/chat/{entry}")
@Authenticated
// The reply is text/event-stream, and each refusal sets application/json itself.
@Produces(MediaType.WILDCARD)
public class ExtensionChatResource {

    private final ExtensionProxyService service;
    private final SecurityIdentity identity;

    @Inject
    public ExtensionChatResource(ExtensionProxyService service, SecurityIdentity identity) {
        this.service = service;
        this.identity = identity;
    }

    @POST
    @Operation(summary = "Send a message to the chat of an extension",
            description = "Checks the message and the shared context, sends them to the extension with a CALM Hub "
                    + "identity assertion, and streams the reply as text/event-stream. Citations that the caller "
                    + "cannot open are left out.")
    public Response post(@PathParam("id") String id, @PathParam("entry") String entry, @Context HttpHeaders headers,
                         InputStream body) {
        try {
            return ExtensionProxyResource.response(service.chat(identity, id, entry,
                    headers.getHeaderString(HttpHeaders.CONTENT_TYPE), headers.getHeaderString(HttpHeaders.ACCEPT_LANGUAGE),
                    body));
        } catch (ExtensionProxyException e) {
            return ExtensionProxyResource.error(e);
        }
    }
}
