package org.finos.calm.mcp.api;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(baseUri = "http://localhost:8080")
public interface FlowClient {
    @GET
    @Path("/calm/namespaces/{namespace}/flows")
    FlowResponse getFlows(@PathParam("namespace") String namespace);
}
