package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.extensions.ExtensionRegistry;
import org.finos.calm.extensions.NotationChecker;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.stream.Stream;

@Tag(name = "Extensions", description = "Extensions that the operator enabled on this CALM Hub")
@Path("/api/calm/extensions")
public class ExtensionResource {

    private final ExtensionRegistry registry;

    @Inject
    public ExtensionResource(ExtensionRegistry registry) {
        this.registry = registry;
    }

    @GET
    @Path("schema/0/blocks.schema.json")
    @Produces(MediaType.APPLICATION_JSON)
    @Authenticated
    @Operation(summary = "Get the hubApi 0 blocks reply schema")
    public Response blocksSchema() throws IOException {
        return schemaResponse(ExtensionResource.class.getResourceAsStream(
                "/META-INF/calm-extensions/schema/0/blocks.schema.json"));
    }

    @GET
    @Path("schema/0/{name: lens|notation}.schema.json")
    @Produces(MediaType.APPLICATION_JSON)
    @Authenticated
    @Operation(summary = "Get the hubApi 0 diagram lens reply or notation schema")
    public Response lensSchema(@PathParam("name") String name) throws IOException {
        // The route allows only these two names. A constant path keeps the request value out of the resource path.
        String file = "lens".equals(name) ? "lens.schema.json" : "notation.schema.json";
        return schemaResponse(ExtensionResource.class.getResourceAsStream("/META-INF/calm-extensions/schema/0/" + file));
    }

    @GET
    @Path("notations/core")
    @Produces(MediaType.APPLICATION_JSON)
    @Authenticated
    @Operation(summary = "Get the core notation: the shapes and edge markers that every diagram lens can name")
    public Response coreNotation() throws IOException {
        return schemaResponse(ExtensionResource.class.getResourceAsStream("/" + NotationChecker.CORE_PATH));
    }

    @GET
    @Path("{id}/lenses/{lens}/notation")
    @Produces(MediaType.APPLICATION_JSON)
    @Authenticated
    @Operation(summary = "Get the notation of a diagram lens",
            description = "The UI reads it when the lens first opens, so the registry stays small with many extensions.")
    public Response lensNotation(@PathParam("id") String id, @PathParam("lens") String lens) {
        return registry.available().stream()
                .filter(manifest -> manifest.id().equals(id))
                .flatMap(manifest -> manifest.contributes().diagramLens() == null ? Stream.empty()
                        : manifest.contributes().diagramLens().stream())
                .filter(entry -> entry.id().equals(lens))
                .findFirst()
                .map(entry -> Response.ok(entry.notationContent()).build())
                .orElse(Response.status(Response.Status.NOT_FOUND).build());
    }

    static Response schemaResponse(InputStream stream) throws IOException {
        try (stream) {
            if (stream == null) {
                return Response.serverError().build();
            }
            return Response.ok(new String(stream.readAllBytes(), StandardCharsets.UTF_8)).build();
        }
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
