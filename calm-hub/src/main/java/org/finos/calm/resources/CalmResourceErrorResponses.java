package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;

public class CalmResourceErrorResponses {
    public static Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid namespace provided: " + namespace).build();
    }

    public static Response decoratorNotFoundResponse(String namespace, int id) {
        return Response.status(Response.Status.NOT_FOUND).entity("Decorator with ID " + id + " does not exist in namespace: " + namespace).build();
    }
}
