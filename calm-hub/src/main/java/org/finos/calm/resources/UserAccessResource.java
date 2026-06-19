package org.finos.calm.resources;

import io.quarkus.security.PermissionsAllowed;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.UserAccessRequest;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
import static org.finos.calm.security.CalmHubPermissionChecker.GLOBAL_ACCESS;

@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
public class UserAccessResource {

    private final UserAccessStore store;
    private final Logger logger = LoggerFactory.getLogger(UserAccessResource.class);

    public UserAccessResource(UserAccessStore userAccessStore) {
        this.store = userAccessStore;
    }

    @POST
    @Path("{namespace}/user-access")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create user access for namespace",
            description = "Creates a user-access for a given namespace on a particular resource type"
    )
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response createUserAccessForNamespace(@PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
                                                 @Valid @NotNull UserAccessRequest request) {

        if (GLOBAL_ACCESS.equals(namespace)) {
            if ("*".equals(request.getUsername())) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("Wildcard username is not permitted for the GLOBAL namespace")
                        .build();
            }
            if (request.getPermission() != UserAccess.Permission.admin) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("Only 'admin' permission is valid for the GLOBAL namespace")
                        .build();
            }
        }

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setNamespace(namespace)
                .setUsername(request.getUsername())
                .setPermission(request.getPermission())
                .build();
        userAccess.setCreationDateTime(LocalDateTime.now());
        userAccess.setUpdateDateTime(LocalDateTime.now());
        try {
            return locationResponse(store.createUserAccessForNamespace(userAccess));
        } catch (NamespaceNotFoundException exception) {
            logger.error("Invalid namespace [{}] when creating user access", namespace, exception);
            return invalidNamespaceResponse(namespace);
        } catch (URISyntaxException ex) {
            logger.error("Failed to create user-access for namespace: [{}] ", namespace, ex);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("System Malfunction failed to create user-access").build();
        }
    }

    @GET
    @Path("{namespace}/user-access")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get user-access for a given namespace",
            description = "Get user-access details for a given namespace"
    )
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response getUserAccessForNamespace(@PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace) {

        try {
            return Response.ok(store.getUserAccessForNamespace(namespace)).build();
        } catch (NamespaceNotFoundException exception) {
            logger.error("Invalid namespace [{}] when getting user-access details", namespace, exception);
            return invalidNamespaceResponse(namespace);
        }
    }

    @GET
    @Path("{namespace}/user-access/{userAccessId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get the user-access record for a given namespace and Id",
            description = "Get user-access details for a given namespace and Id"
    )
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response getUserAccessForNamespaceAndId(@PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
                                                   @PathParam("userAccessId") @NotNull Integer userAccessId) {

        try {
            return Response.ok(store.getUserAccessForNamespaceAndId(namespace, userAccessId))
                    .build();
        } catch (NamespaceNotFoundException exception) {
            logger.error("Invalid namespace [{}] when getting user-access details", namespace, exception);
            return invalidNamespaceResponse(namespace);
        } catch (UserAccessNotFoundException ex) {
            logger.error("Use-access details are not found [{}]", namespace, ex);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("No access permissions found").build();
        }
    }

    @DELETE
    @Path("{namespace}/user-access/{userAccessId}")
    @Operation(
            summary = "Revoke a user-access grant",
            description = "Deletes the user-access record for the given namespace and id"
    )
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response deleteUserAccessForNamespace(@PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
                                                 @PathParam("userAccessId") @NotNull Integer userAccessId) {
        try {
            store.deleteUserAccessForNamespace(namespace, userAccessId);
            return Response.noContent().build();
        } catch (NamespaceNotFoundException exception) {
            logger.error("Invalid namespace [{}] when deleting user access", namespace, exception);
            return invalidNamespaceResponse(namespace);
        } catch (UserAccessNotFoundException ex) {
            logger.error("User-access record [{}] not found in namespace [{}]", userAccessId, namespace, ex);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("No access permissions found").build();
        }
    }

    private Response locationResponse(UserAccess userAccess) throws URISyntaxException {
        return Response.created(new URI(
                        String.format("/api/calm/namespaces/%s/user-access/%s", userAccess.getNamespace(), userAccess.getUserAccessId())))
                .build();
    }

    private Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Invalid namespace provided: " + STRICT_SANITIZATION_POLICY.sanitize(namespace))
                .build();
    }
}
