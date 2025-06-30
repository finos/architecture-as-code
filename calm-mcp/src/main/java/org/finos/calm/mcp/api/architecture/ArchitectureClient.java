package org.finos.calm.mcp.api.architecture;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(baseUri = "http://localhost:8080")
public interface ArchitectureClient {
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Path("/calm/namespaces/{namespace}/architectures/{architectureId}/versions/{version}")
    String getArchitecture(String namespace, String architectureId, String version);
}
