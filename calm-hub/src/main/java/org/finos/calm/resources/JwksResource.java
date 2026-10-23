package org.finos.calm.resources;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.extensions.ExtensionIdentitySigner;

import java.util.Map;

@Tag(name = "Extensions", description = "Extensions that the operator enabled on this CALM Hub")
@Path("/api/calm/auth/jwks")
public class JwksResource {

    private final ExtensionIdentitySigner signer;

    @Inject
    public JwksResource(ExtensionIdentitySigner signer) {
        this.signer = signer;
    }

    @GET
    @PermitAll
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get the keys that check the identity Hub sends to extensions")
    public Response getJwks() {
        return Response.ok(Map.of("keys", signer.publicKeys())).build();
    }
}
