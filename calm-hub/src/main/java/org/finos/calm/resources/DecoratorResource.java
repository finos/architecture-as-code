package org.finos.calm.resources;

import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSchemaValidationException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.DecoratorTooLargeException;
import org.finos.calm.domain.exception.HubOwnedDecoratorFieldException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.ReservedDecoratorTypeException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.DecoratorWriteService;
import org.finos.calm.store.DecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;

import static org.finos.calm.resources.ResourceValidationConstants.*;

/**
 * Resource for managing decorators in a given namespace
 */
@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
public class DecoratorResource {

    private static final String BAD_DECORATOR = "The JSON does not parse, a field that Hub reads has the wrong type, the body sends a "
            + "Hub-owned field, the decorator does not match a $schema that Hub knows, or the store cannot keep a key of the "
            + "decorator. A $schema mismatch lists at most 20 errors, and moreErrors counts the rest";
    private static final String TOO_LARGE = "The decorator JSON is larger than " + SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES
            + " bytes (1 MiB), or the namespace has reached the maximum storage size";

    private final DecoratorStore decoratorStore;
    private final DecoratorWriteService decoratorWriteService;
    private final SecurityIdentity identity;
    private final Logger logger = LoggerFactory.getLogger(DecoratorResource.class);

    @Inject
    public DecoratorResource(DecoratorStore decoratorStore, DecoratorWriteService decoratorWriteService, SecurityIdentity identity) {
        this.decoratorStore = decoratorStore;
        this.decoratorWriteService = decoratorWriteService;
        this.identity = identity;
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
    @PermissionsAllowed(CalmHubScopes.READ)
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
     * Retrieve a list of decorator values in a given namespace with optional filtering
     *
     * @param namespace the namespace to retrieve decorators for
     * @param target optional target path to filter by (e.g., "/calm/namespaces/finos/architectures/1/versions/1-0-0")
     * @param type optional decorator type to filter by (e.g., "deployment", "observability")
     * @return a list of decorators matching the criteria
     */
    @GET
    @Path("{namespace}/decorators/values")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve decorator values in a given namespace",
            description = "Decorator values stored in a given namespace, optionally filtered by target and/or type"
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getDecoratorValuesForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @QueryParam("target") @Size(max = 500) @Pattern(regexp = QUERY_PARAM_NO_WHITESPACE_REGEX, message = QUERY_PARAM_NO_WHITESPACE_MESSAGE) String target,
            @QueryParam("type") @Size(max = 100) @Pattern(regexp = QUERY_PARAM_NO_WHITESPACE_REGEX, message = QUERY_PARAM_NO_WHITESPACE_MESSAGE) String type
    ) {
        try {
            return Response.ok(new ValueWrapper<>(decoratorStore.getDecoratorValuesForNamespace(namespace, target, type))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving decorator values", namespace, e);
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
    @PermissionsAllowed(CalmHubScopes.READ)
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

    /**
     * Retrieve the history that contains a decorator in a given namespace
     *
     * @param namespace the namespace containing the decorator
     * @param id the id of any decorator in the history
     * @return the current decorator first, then each one it supersedes
     */
    @GET
    @Path("{namespace}/decorators/{id}/history")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve the history of a decorator in a given namespace",
            description = "The current decorator first, then each one it supersedes. Updates involving reserved types create history entries"
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getDecoratorHistory(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id
    ) {
        try {
            return Response.ok(new ValueWrapper<>(decoratorStore.getDecoratorHistory(namespace, id))).build();
        } catch (DecoratorNotFoundException e) {
            logger.error("Decorator [{}] not found in namespace [{}] when retrieving its history", id, namespace, e);
            return CalmResourceErrorResponses.decoratorNotFoundResponse(namespace, id);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving the history of decorator [{}]", namespace, id, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    /**
     * Create a new decorator in a given namespace.
     *
     * @param namespace     the namespace to create the decorator in
     * @param decoratorJson the decorator JSON body
     * @return 201 Created with Location header, or an appropriate error response
     */
    @POST
    @Path("{namespace}/decorators")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create a decorator in a given namespace",
            description = "Creates a decorator, validating the namespace exists and the JSON is well-formed"
    )
    @APIResponses({
            @APIResponse(responseCode = "201", description = "Created. The body has the new id, and Location names the decorator"),
            @APIResponse(responseCode = "400", description = BAD_DECORATOR),
            @APIResponse(responseCode = "403", description = "The type is reserved, and the caller is not one of its writers"),
            @APIResponse(responseCode = "404", description = "The namespace does not exist"),
            @APIResponse(responseCode = "413", description = TOO_LARGE)
    })
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createDecoratorForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            String decoratorJson
    ) throws URISyntaxException {
        try {
            int id = decoratorWriteService.createDecorator(DecoratorWriteService.principalName(identity), namespace, decoratorJson);
            URI location = new URI("/api/calm/namespaces/" + namespace + "/decorators/" + id);
            return Response.created(location).entity(Map.of("id", id)).build();
        } catch (JsonParseException e) {
            logger.error("Invalid JSON when creating decorator in namespace [{}]", namespace, e);
            return CalmResourceErrorResponses.invalidDecoratorJsonResponse();
        } catch (DecoratorKeyRefusedException e) {
            logger.warn("Refused a decorator key that the store cannot keep in namespace [{}]", namespace);
            return CalmResourceErrorResponses.decoratorKeyRefusedResponse(e);
        } catch (DecoratorTooLargeException e) {
            logger.warn("Refused a decorator larger than the limit in namespace [{}]", namespace);
            return CalmResourceErrorResponses.decoratorTooLargeResponse();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating decorator", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (HubOwnedDecoratorFieldException e) {
            logger.warn("Refused a Hub-owned decorator field [{}] in namespace [{}]", e.getField(), namespace);
            return CalmResourceErrorResponses.hubOwnedDecoratorFieldResponse(e.getField());
        } catch (ReservedDecoratorTypeException e) {
            logger.warn("Refused a reserved decorator type when creating a decorator in namespace [{}]", namespace);
            return CalmResourceErrorResponses.reservedDecoratorTypeResponse(e.getType());
        } catch (DecoratorSchemaValidationException e) {
            logger.warn("Decorator does not match its $schema when creating a decorator in namespace [{}]", namespace);
            return CalmResourceErrorResponses.decoratorSchemaValidationResponse(e);
        }
    }

    /**
     * Update an existing decorator by ID in a given namespace.
     *
     * @param namespace     the namespace containing the decorator
     * @param id            the id of the decorator to update
     * @param decoratorJson the updated decorator JSON body
     * @return 200 OK, 201 Created with a Location header when a reserved-type decorator is superseded, or an
     * appropriate error response
     */
    @PUT
    @Path("{namespace}/decorators/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Update a decorator by ID in a given namespace",
            description = "Updates an existing decorator, validating the namespace and ID exist and the JSON is well-formed. "
                    + "A reserved-type decorator is append-only: the update stores a new decorator that supersedes it, "
                    + "and returns 201 with its ID"
    )
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Updated in place"),
            @APIResponse(responseCode = "201", description = "Superseded. The body has the new id, and Location names the new decorator"),
            @APIResponse(responseCode = "400", description = BAD_DECORATOR),
            @APIResponse(responseCode = "403", description = "The old or new type is reserved, and the caller is not one of its writers"),
            @APIResponse(responseCode = "404", description = "The namespace or the decorator does not exist"),
            @APIResponse(responseCode = "409", description = "The decorator has been superseded. Update the current decorator in its history"),
            @APIResponse(responseCode = "413", description = TOO_LARGE)
    })
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response updateDecoratorForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id,
            String decoratorJson
    ) throws URISyntaxException {
        try {
            int currentId = decoratorWriteService.updateDecorator(DecoratorWriteService.principalName(identity), namespace, id, decoratorJson);
            if (currentId == id) {
                return Response.ok().build();
            }
            URI location = new URI("/api/calm/namespaces/" + namespace + "/decorators/" + currentId);
            return Response.created(location).entity(Map.of("id", currentId)).build();
        } catch (JsonParseException e) {
            logger.error("Invalid JSON when updating decorator [{}] in namespace [{}]", id, namespace, e);
            return CalmResourceErrorResponses.invalidDecoratorJsonResponse();
        } catch (DecoratorKeyRefusedException e) {
            logger.warn("Refused a decorator key that the store cannot keep for decorator [{}] in namespace [{}]", id, namespace);
            return CalmResourceErrorResponses.decoratorKeyRefusedResponse(e);
        } catch (DecoratorTooLargeException e) {
            logger.warn("Refused a decorator larger than the limit in namespace [{}]", namespace);
            return CalmResourceErrorResponses.decoratorTooLargeResponse();
        } catch (DecoratorNotFoundException e) {
            logger.error("Decorator [{}] not found in namespace [{}] when updating", id, namespace, e);
            return CalmResourceErrorResponses.decoratorNotFoundResponse(namespace, id);
        } catch (DecoratorSupersededException e) {
            logger.warn("Decorator [{}] in namespace [{}] has been superseded", id, namespace);
            return CalmResourceErrorResponses.decoratorSupersededResponse(namespace, id);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when updating decorator [{}]", namespace, id, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (HubOwnedDecoratorFieldException e) {
            logger.warn("Refused a Hub-owned decorator field [{}] in namespace [{}]", e.getField(), namespace);
            return CalmResourceErrorResponses.hubOwnedDecoratorFieldResponse(e.getField());
        } catch (ReservedDecoratorTypeException e) {
            logger.warn("Refused a reserved decorator type when updating decorator [{}] in namespace [{}]", id, namespace);
            return CalmResourceErrorResponses.reservedDecoratorTypeResponse(e.getType());
        } catch (DecoratorSchemaValidationException e) {
            logger.warn("Decorator [{}] in namespace [{}] does not match its $schema when updating", id, namespace);
            return CalmResourceErrorResponses.decoratorSchemaValidationResponse(e);
        }
    }

    /**
     * Delete an existing decorator by ID in a given namespace.
     *
     * @param namespace the namespace containing the decorator
     * @param id        the id of the decorator to delete
     * @return 204 No Content, or an appropriate error response
     */
    @DELETE
    @Path("{namespace}/decorators/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Delete a decorator by ID in a given namespace",
            description = "Deletes a decorator, with its whole history, from the given namespace. Requires global admin privilege."
    )
    @APIResponses({
            @APIResponse(responseCode = "204", description = "Deleted, with its whole history"),
            @APIResponse(responseCode = "404", description = "The namespace or the decorator does not exist"),
            @APIResponse(responseCode = "409", description = "Another write superseded the decorator during the delete. Nothing was deleted. Retry the delete")
    })
    @PermissionsAllowed(CalmHubScopes.GLOBAL_ADMIN)
    public Response deleteDecoratorForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id
    ) {
        try {
            decoratorWriteService.deleteDecorator(namespace, id);
        } catch (DecoratorNotFoundException e) {
            logger.error("Decorator [{}] not found in namespace [{}] when deleting", id, namespace, e);
            return CalmResourceErrorResponses.decoratorNotFoundResponse(namespace, id);
        } catch (DecoratorSupersededException e) {
            logger.warn("Decorator [{}] in namespace [{}] was superseded while deleting", id, namespace);
            return CalmResourceErrorResponses.decoratorDeleteConflictResponse(namespace, id);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when deleting decorator [{}]", namespace, id, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
        return Response.noContent().build();
    }
}
