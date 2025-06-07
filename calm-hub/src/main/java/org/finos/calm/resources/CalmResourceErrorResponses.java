package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;

public class CalmResourceErrorResponses {
    public static Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid namespace provided: " + namespace).build();
    }
}
