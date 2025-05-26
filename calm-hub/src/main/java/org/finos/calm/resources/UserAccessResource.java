package org.finos.calm.resources;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;

@Path("/calm/namespaces")
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
    @PermittedScopes({CalmHubScopes.NAMESPACE_ADMIN})
    public Response createUserAccessForNamespace(@PathParam("namespace") String namespace,
                                                 UserAccess createUserAccessRequest) {

        createUserAccessRequest.setCreationDateTime(LocalDateTime.now());
        createUserAccessRequest.setUpdateDateTime(LocalDateTime.now());
        if (!namespace.equals(createUserAccessRequest.getNamespace())) {
            logger.error("Request contains an invalid namespace [{}]", createUserAccessRequest.getNamespace());
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Bad Request").build();
        }
        try {
            return locationResponse(store.createUserAccessForNamespace(createUserAccessRequest));
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
    @PermittedScopes({CalmHubScopes.NAMESPACE_ADMIN})
    public Response getUserAccessForNamespace(@PathParam("namespace") String namespace) {

        try {
            return Response.ok(store.getUserAccessForNamespace(namespace))
                    .build();
        } catch (NamespaceNotFoundException exception) {
            logger.error("Invalid namespace [{}] when getting user-access details", namespace, exception);
            return invalidNamespaceResponse(namespace);
        } catch (UserAccessNotFoundException ex) {
            logger.error("Use-access details are not found [{}]", namespace, ex);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("No access permissions found")
                    .build();
        }
    }

    @GET
    @Path("{namespace}/user-access/{userAccessId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get the user-access record for a given namespace and Id",
            description = "Get user-access details for a given namespace and Id"
    )
    @PermittedScopes({CalmHubScopes.NAMESPACE_ADMIN})
    public Response getUserAccessForNamespaceAndId(@PathParam("namespace") String namespace,
                                                   @PathParam("userAccessId") Integer userAccessId) {

        try {
            return Response.ok(store.getUserAccessForNamespaceAndId(namespace, userAccessId))
                    .build();
        } catch (NamespaceNotFoundException exception) {
            logger.error("Invalid namespace [{}] when getting user-access details", namespace, exception);
            return invalidNamespaceResponse(namespace);
        } catch (UserAccessNotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("No access permissions found").build();
        }
    }

    private Response locationResponse(UserAccess userAccess) throws URISyntaxException {
        return Response.created(new URI(
                        String.format("/calm/namespaces/%s/user-access/%s", userAccess.getNamespace(), userAccess.getUserAccessId())))
                .build();
    }

    private Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Invalid namespace provided: " + namespace)
                .build();
    }
}
