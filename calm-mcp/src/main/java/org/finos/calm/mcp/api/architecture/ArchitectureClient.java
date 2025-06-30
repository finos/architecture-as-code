package org.finos.calm.mcp.api.architecture;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(baseUri = "http://localhost:8080")
public interface ArchitectureClient {
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Path("/calm/namespaces/{namespace}/architectures/{architectureId}/versions/{version}")
    String getArchitecture(String namespace, String architectureId, String version);

    @POST
    @Path("/calm/namespaces/{namespace}/architectures/{architectureId}/versions/{version}")
    void postArchitecture(
            @PathParam("namespace") String namespace,
            @PathParam("architectureId") String architectureId,
            @PathParam("version") String version,
            String architecture
    );
}
