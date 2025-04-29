package org.finos.calm.resources;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.CoreSchemaStore;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;

import java.util.ArrayList;
import java.util.Map;

@Path("/calm/schemas")
public class CoreSchemaResource {

    private static final PolicyFactory STRICT_SANITIZATION_POLICY = new HtmlPolicyBuilder().toFactory();

    private final CoreSchemaStore coreSchemaStore;

    public CoreSchemaResource(CoreSchemaStore coreSchemaStore) {
        this.coreSchemaStore = coreSchemaStore;
    }

    @GET
    @Operation(
            summary = "Published CALM Schema Versions",
            description = "Retrieve the CALM Schema versions published by this CALM Hub"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public ValueWrapper<String> schemaVersions() {
        return new ValueWrapper<>(coreSchemaStore.getVersions());
    }

    @GET
    @Path("{version}/meta")
    @Operation(
            summary = "Published CALM Schemas for Version",
            description = "Retrieve the names of CALM Schemas in a given version"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response schemasForVersion(@PathParam("version") String version) {
        Map<String, Object> schemas = coreSchemaStore.getSchemasForVersion(version);
        if (schemas == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Version not found: " + STRICT_SANITIZATION_POLICY.sanitize(version))
                    .build();
        }
        return Response.ok(new ValueWrapper<>(new ArrayList<>(schemas.keySet()))).build();
    }

    @GET
    @Path("{version}/meta/{schemaName}")
    @Operation(
            summary = "Retrieve a specific schema by schema name",
            description = "Retrieve a specific schema from the CALM Hub"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getSchema(@PathParam("version") String version,
                              @PathParam("schemaName") String schemaName) {
        Map<String, Object> schemas = coreSchemaStore.getSchemasForVersion(version);
        if (schemas == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Version not found: " + STRICT_SANITIZATION_POLICY.sanitize(version))
                    .build();
        }
        if(!schemas.containsKey(schemaName)) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Schema: [" + STRICT_SANITIZATION_POLICY.sanitize(schemaName) + "] not found for version: [" + STRICT_SANITIZATION_POLICY.sanitize(version) + "]").build();
        }

        return Response.ok(schemas.get(schemaName)).build();
    }
}