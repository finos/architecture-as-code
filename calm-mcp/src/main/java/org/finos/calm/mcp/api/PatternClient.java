package org.finos.calm.mcp.api;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(baseUri = "http://localhost:8080")
public interface PatternClient {
    @GET
    @Path("/calm/namespaces/{namespace}/patterns")
    PatternResponse getPatterns(@PathParam("namespace") String namespace);

    @GET
    @Path("/calm/namespaces/{namespace}/patterns/{patternId}/versions")
    PatternVersionResponse getPatternVersions(@PathParam("namespace") String namespace, @PathParam("patternId") int patternId);

    @GET
    @Path("/calm/namespaces/{namespace}/patterns/{patternId}/versions/{version}")
    Object getPattern(@PathParam("namespace") String namespace, @PathParam("patternId") int patternId, @PathParam("version") String version);
}
