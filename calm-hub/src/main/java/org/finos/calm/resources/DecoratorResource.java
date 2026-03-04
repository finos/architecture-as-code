package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
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
     * Retrieve a list of decorator unique IDs in a given namespace
     *
     * @param namespace the namespace to retrieve decorators for
     * @return a list of decorator unique IDs in the given namespace
     */
    @GET
    @Path("{namespace}/decorators")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve decorators in a given namespace",
            description = "Decorator unique IDs stored in a given namespace"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getDecoratorsForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace
    ) {
        try {
            return Response.ok(new ValueWrapper<>(decoratorStore.getDecoratorsForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving decorators", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }
}
