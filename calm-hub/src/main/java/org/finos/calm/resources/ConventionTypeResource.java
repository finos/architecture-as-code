package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.ConventionTypeSummary;

import java.util.Arrays;

@Tag(name = "Conventions", description = "Versioned tool conventions and namespace defaults")
@Path("/api/calm/convention-types")
public class ConventionTypeResource {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List convention types", description = "Returns each convention type and the schema that its conventions must match.")
    @APIResponse(responseCode = "200", description = "Convention types returned")
    @Authenticated
    public Response listConventionTypes() {
        return Response.ok(new ValueWrapper<>(Arrays.stream(ConventionType.values())
                .map(type -> new ConventionTypeSummary(type.getName(), type.getSchemaId()))
                .toList())).build();
    }
}
