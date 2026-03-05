package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.DecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;

/**
 * Resource for managing decorators in a given namespace
 */
@Path("/calm/namespaces")
public class DecoratorResource {

    private final DecoratorStore decoratorStore;
    private final Logger logger = LoggerFactory.getLogger(DecoratorResource.class);

    @Inject
    public DecoratorResource(DecoratorStore decoratorStore) {
        this.decoratorStore = decoratorStore;
    }

    /**
     * Retrieve a list of decorator IDs in a given namespace with optional filtering
     *
     * @param namespace the namespace to retrieve decorators for
     * @param target optional target path to filter by (e.g., "/calm/namespaces/finos/architectures/1/versions/1-0-0")
     * @param type optional decorator type to filter by (e.g., "deployment", "observability")
     * @return a list of decorator IDs matching the criteria
     */
    @GET
    @Path("{namespace}/decorators")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve decorators in a given namespace",
            description = "Decorator IDs stored in a given namespace, optionally filtered by target and/or type"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getDecoratorsForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @QueryParam("target") String target,
            @QueryParam("type") String type
    ) {
        try {
            // Sanitize query parameters
            String sanitizedTarget = sanitizeQueryParam(target, 500);
            String sanitizedType = sanitizeQueryParam(type, 100);
            
            return Response.ok(new ValueWrapper<>(decoratorStore.getDecoratorsForNamespace(namespace, sanitizedTarget, sanitizedType))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving decorators", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (IllegalArgumentException e) {
            logger.error("Invalid query parameter when retrieving decorators for namespace [{}]", namespace, e);
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(e.getMessage())
                    .build();
        }
    }
    
    /**
     * Sanitizes a query parameter by trimming and validating length
     *
     * @param param the parameter to sanitize
     * @param maxLength maximum allowed length
     * @return null if param is null/empty, otherwise the trimmed value
     * @throws IllegalArgumentException if parameter exceeds max length
     */
    private String sanitizeQueryParam(String param, int maxLength) {
        if (param == null || param.trim().isEmpty()) {
            return null;
        }
        
        String trimmed = param.trim();
        if (trimmed.length() > maxLength) {
            throw new IllegalArgumentException("Query parameter exceeds maximum length of " + maxLength);
        }
        
        return trimmed;
    }
}
