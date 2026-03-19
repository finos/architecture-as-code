package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.DecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.QUERY_PARAM_NO_WHITESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.QUERY_PARAM_NO_WHITESPACE_REGEX;

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
            @QueryParam("target") @Size(max = 500) @Pattern(regexp = QUERY_PARAM_NO_WHITESPACE_REGEX, message = QUERY_PARAM_NO_WHITESPACE_MESSAGE) String target,
            @QueryParam("type") @Size(max = 100) @Pattern(regexp = QUERY_PARAM_NO_WHITESPACE_REGEX, message = QUERY_PARAM_NO_WHITESPACE_MESSAGE) String type
    ) {
        try {
            return Response.ok(new ValueWrapper<>(decoratorStore.getDecoratorsForNamespace(namespace, target, type))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving decorators", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    /**
     * Retrieve a decorator by its ID in a given namespace
     *
     * @param namespace the namespace to retrieve decorators for
     * @param id the id of the decorator
     * @return a decorator
     */
    @GET
    @Path("{namespace}/decorators/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a decorator by its ID in a given namespace",
            description = "A decorator stored in a given namespace"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getDecoratorById(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id
    ) {
        try {
            return decoratorStore.getDecoratorById(namespace, id)
                    .map(decorator -> Response.ok(decorator).build())
                    .orElse(CalmResourceErrorResponses.decoratorNotFoundResponse(namespace, id));
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving decorator with id [{}]", namespace, id, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }
}
