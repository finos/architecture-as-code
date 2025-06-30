package org.finos.calm.mcp.api.architectures;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(baseUri = "http://localhost:8080")
public interface ArchitecturesClient {
    @GET
    @Path("/calm/namespaces/{namespace}/architectures")
    ArchitecturesResponse getArchitectures(String namespace);

    @POST
    @Path("/calm/namespaces/{namespace}/architectures")
    void postNewArchitecture(@PathParam("namespace") String namespace, String architecture);
}
