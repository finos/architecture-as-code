package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.CoreSchemaStore;

import org.owasp.html.PolicyFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Map;

@Path("/calm/schemas")
public class CoreSchemaResource {

    private static final PolicyFactory STRICT_SANITIZATION_POLICY = ResourceValidationConstants.STRICT_SANITIZATION_POLICY;

    private final CoreSchemaStore coreSchemaStore;

    @Inject
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

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create Schema Version",
            description = "Create a new schema version with associated schemas"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createSchemaVersion(SchemaVersionRequest request) throws URISyntaxException {
        if (request == null || request.getVersion() == null || request.getVersion().trim().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"Version is required\"}")
                    .build();
        }

        if (request.getSchemas() == null || request.getSchemas().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"Schemas are required\"}")
                    .build();
        }

        String version = request.getVersion().trim();
        
        // Check if version already exists
        if (coreSchemaStore.getSchemasForVersion(version) != null) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("{\"error\":\"Schema version already exists\"}")
                    .build();
        }

        coreSchemaStore.createSchemaVersion(version, request.getSchemas());
        return Response.created(new URI("/calm/schemas/" + version + "/meta")).build();
    }

    // Inner class for request body
    public static class SchemaVersionRequest {
        private String version;
        private Map<String, Object> schemas;

        public String getVersion() {
            return version;
        }

        public void setVersion(String version) {
            this.version = version;
        }

        public Map<String, Object> getSchemas() {
            return schemas;
        }

        public void setSchemas(Map<String, Object> schemas) {
            this.schemas = schemas;
        }
    }
}