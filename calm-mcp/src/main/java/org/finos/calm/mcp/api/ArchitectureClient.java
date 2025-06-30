package org.finos.calm.mcp.api;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(baseUri = "http://localhost:8080")
public interface ArchitectureClient {
    @GET
    @Path("/calm/namespaces/{namespace}/architectures")
    ArchitectureResponse getArchitectures(@PathParam("namespace") String namespace);
    
    @GET
    @Path("/calm/namespaces/{namespace}/architectures/{architectureId}/versions")
    ArchitectureResponse getArchitectureVersions(@PathParam("namespace") String namespace, 
                                                 @PathParam("architectureId") int architectureId);
    
    @GET
    @Path("/calm/namespaces/{namespace}/architectures/{architectureId}/versions/{version}")
    Object getArchitecture(@PathParam("namespace") String namespace,
                           @PathParam("architectureId") int architectureId,
                           @PathParam("version") String version);
}
