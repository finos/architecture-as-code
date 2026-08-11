package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.ResourceType;

public class CalmResourceErrorResponses {
    public static Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Invalid namespace provided: " + ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(namespace))
                .build();
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

    /**
     * Returns a 404 response for a layout write against an architecture id that does not
     * exist. Deliberately not a reuse of {@link org.finos.calm.resources.ArchitectureResource}'s
     * own not-found response — that one is terser ("Invalid architecture provided") and
     * changing it would alter five existing, already-tested response bodies for a change
     * scoped to layout saves.
     */
    public static Response architectureNotFoundResponse(String namespace, int architectureId) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Architecture " + architectureId + " does not exist in namespace: "
                        + ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(namespace))
                .build();
    }

    public static Response layoutNotFoundResponse(String namespace, int architectureId) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("No default layout saved for architecture " + architectureId + " in namespace: "
                        + ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(namespace))
                .build();
    }

    /**
     * Returns a 400 response for a layout PUT whose {@code for} target does not match the
     * architecture named in the URL. {@code forPath} is user-derived (parsed straight out of
     * the request body) and is sanitized before being echoed back; {@code expectedPath} is
     * server-constructed from validated path parameters and is trusted as-is.
     */
    public static Response invalidLayoutTargetResponse(String forPath, String expectedPath) {
        String sanitizedForPath = ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(forPath);
        return Response.status(Response.Status.BAD_REQUEST)
                .entity("Layout 'for' [" + sanitizedForPath + "] does not match architecture [" + expectedPath + "]")
                .build();
    }

    /**
     * Returns a 409 response for a namespace-deletion attempt that was refused because the
     * namespace still has content or child namespaces. Only the namespace name — the
     * user-derived value — is sanitized; the surrounding literal text is trusted and left
     * untouched, so sanitization doesn't HTML-entity-encode ordinary punctuation in the
     * message. Child namespaces are reported as a count rather than enumerated by name,
     * since a namespace can have arbitrarily many children.
     */
    public static Response namespaceNotEmptyResponse(String namespace, int childNamespaceCount) {
        String sanitizedNamespace = ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(namespace);
        String message = childNamespaceCount > 0
                ? "Namespace " + sanitizedNamespace + " has " + childNamespaceCount
                        + " child namespace(s) and cannot be deleted"
                : "Namespace " + sanitizedNamespace + " contains resources and cannot be deleted";
        return Response.status(Response.Status.CONFLICT).entity(message).build();
    }

    /**
     * Returns a 409 response for a domain-deletion attempt that was refused because the
     * domain still has controls associated with it. Formatted to match
     * {@link #namespaceNotEmptyResponse(String, int)} — no quotes around the entity name.
     */
    public static Response domainNotEmptyResponse(String domain) {
        String sanitizedDomain = ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(domain);
        return Response.status(Response.Status.CONFLICT)
                .entity("Domain " + sanitizedDomain + " contains controls and cannot be deleted")
                .build();
    }

    /**
     * Returns a 409 response for a resource push whose customId already maps to a resource of
     * the given type in the namespace. {@code resourceType} is server-controlled (an enum
     * constant, never user input) and is interpolated as-is; {@code name} and {@code namespace}
     * are user-derived and sanitized.
     */
    public static Response resourceAlreadyExistsResponse(ResourceType resourceType, String name, String namespace) {
        String sanitizedName = ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(name);
        String sanitizedNamespace = ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(namespace);
        return Response.status(Response.Status.CONFLICT)
                .entity(resourceType.name().toLowerCase() + " '" + sanitizedName
                        + "' already exists in namespace '" + sanitizedNamespace + "'")
                .build();
    }

    /**
     * Returns a 409 response for a resource push whose explicit version already exists.
     * {@code resourceType} is server-controlled and interpolated as-is; {@code version} is
     * echoed unsanitized, matching every other version-conflict message in this codebase
     * (e.g. {@code ArchitectureTools}, {@code MongoVersionDocumentStore}) — the version comes
     * from the request's already {@code @Pattern}-validated version path/field, not free text.
     * {@code name} and {@code namespace} are user-derived and sanitized.
     */
    public static Response versionAlreadyExistsResponse(String version, ResourceType resourceType, String name, String namespace) {
        String sanitizedName = ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(name);
        String sanitizedNamespace = ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(namespace);
        return Response.status(Response.Status.CONFLICT)
                .entity("Version " + version + " already exists for " + resourceType.name().toLowerCase()
                        + " '" + sanitizedName + "' in namespace '" + sanitizedNamespace + "'")
                .build();
    }
}
