package org.finos.calm.mcp.api.architectureVersions;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(baseUri = "http://localhost:8080")
public interface ArchitectureVersionsClient {
    @GET
    @Path("/calm/namespaces/{namespace}/architectures/{architectureId}/versions")
    VersionsResponse getArchitectureVersions(String namespace, String architectureId);
}
