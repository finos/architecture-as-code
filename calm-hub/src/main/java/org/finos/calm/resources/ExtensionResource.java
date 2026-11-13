package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.extensions.ExtensionRegistry;

@Tag(name = "Extensions", description = "Extensions that the operator enabled on this CALM Hub")
@Path("/api/calm/extensions")
public class ExtensionResource {

    private final ExtensionRegistry registry;

    @Inject
    public ExtensionResource(ExtensionRegistry registry) {
        this.registry = registry;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Authenticated
    @Operation(
            summary = "List the enabled extensions",
            description = "Returns the enabled extensions in order, with their routes, commands and contributions. "
                    + "Leaves out backend URLs, and the routes and commands that this CALM Hub cannot run, such as "
                    + "write routes on a read-only CALM Hub."
    )
    public Response listExtensions() {
        return Response.ok(new ValueWrapper<>(registry.available())).build();
    }
}
