package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;

public class CalmResourceErrorResponses {
    public static Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid namespace provided: " + namespace).build();
    }

    public static Response invalidDomainResponse(String domain) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Invalid domain provided: " + ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(domain))
                .build();
    }

    /**
     * Returns a 400 response for an unparseable JSON payload. The body is intentionally generic and does not
     * echo the request payload, to avoid leaking user input into error responses.
     *
     * @param resourceType the kind of resource whose JSON failed to parse (e.g. "architecture", "pattern", "timeline")
     */
    public static Response invalidJsonResponse(String resourceType) {
        return Response.status(Response.Status.BAD_REQUEST).entity("The " + resourceType + " JSON could not be parsed").build();
    }

    public static Response decoratorNotFoundResponse(String namespace, int id) {
        return Response.status(Response.Status.NOT_FOUND).entity("Decorator with ID " + id + " does not exist in namespace: " + namespace).build();
    }

    public static Response invalidDecoratorJsonResponse(String message) {
        return Response.status(Response.Status.BAD_REQUEST).entity("Invalid decorator JSON: " + message).build();
    }
}
