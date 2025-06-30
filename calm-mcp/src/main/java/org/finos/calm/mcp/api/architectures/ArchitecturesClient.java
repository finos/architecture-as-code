package org.finos.calm.mcp.api.architectures;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(baseUri = "http://localhost:8080")
public interface ArchitecturesClient {
    @GET
    @Path("/calm/namespaces/{namespace}/architectures")
    ArchitecturesResponse getArchitectures(String namespace);
}
