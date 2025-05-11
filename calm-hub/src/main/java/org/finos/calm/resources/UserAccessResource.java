package org.finos.calm.resources;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
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

    public UserAccessResource(UserAccessStore userAccessStore){
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
                                                 UserAccess userAccess) throws URISyntaxException {

        userAccess.setCreationDateTime(LocalDateTime.now());
        userAccess.setUpdateDateTime(LocalDateTime.now());
        try {
            return locationResponse(store.createUserAccessForNamespace(userAccess));
        } catch (NamespaceNotFoundException exception) {
            logger.error("Invalid namespace [{}] when creating user access", namespace, exception);
            return invalidNamespaceResponse(namespace);
        } catch (Exception exception) {
            logger.error("Internal server error, namespace: {}, exception: {}", namespace, exception);
            return Response.serverError().build();
        }
    }

    @GET
    @Path("{namespace}/user-access")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get user-access for a given namespace",
            description = "Get user-access details for a given namespace"
    )
    @PermittedScopes({CalmHubScopes.NAMESPACE_ADMIN})
    public Response getUserAccessForNamespace(@PathParam("namespace") String namespace) throws URISyntaxException {

        try {
            return Response.ok(store.getUserAccessForNamespace(namespace))
                    .build();
        } catch (NamespaceNotFoundException exception) {
            logger.error("Invalid namespace [{}] when getting user-access details", namespace, exception);
            return invalidNamespaceResponse(namespace);
        } catch (Exception exception) {
            logger.error("Internal server error, namespace: {}", namespace, exception);
            return Response.serverError().build();
        }
    }

    private Response locationResponse(UserAccess userAccess) throws URISyntaxException {
        return Response.created(new URI(
                        String.format("/calm/namespaces/%s/user-access/%s", userAccess.getNamespace(), userAccess.getId())))
                .build();
    }

    private Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid namespace provided: " + namespace).build();
    }
}
