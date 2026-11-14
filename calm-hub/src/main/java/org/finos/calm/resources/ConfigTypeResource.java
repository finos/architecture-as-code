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
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.ConfigTypeSummary;

import java.util.Arrays;

@Tag(name = "Configs", description = "Versioned tool configs and namespace defaults")
@Path("/api/calm/config-types")
public class ConfigTypeResource {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List config types", description = "Returns each config type and the schema that its configs must match.")
    @APIResponse(responseCode = "200", description = "Config types returned")
    @Authenticated
    public Response listConfigTypes() {
        return Response.ok(new ValueWrapper<>(Arrays.stream(ConfigType.values())
                .map(type -> new ConfigTypeSummary(type.getName(), type.getSchemaId()))
                .toList())).build();
    }
}
