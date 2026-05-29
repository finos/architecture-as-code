package org.finos.calm.resources;

import io.quarkus.security.PermissionsAllowed;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;

@Path("/calm/domains")
public class DomainUserAccessResource {

    private final UserAccessStore store;
    private final Logger logger = LoggerFactory.getLogger(DomainUserAccessResource.class);

    public DomainUserAccessResource(UserAccessStore userAccessStore) {
        this.store = userAccessStore;
    }

    @POST
    @Path("{domain}/user-access")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create user access for domain",
            description = "Creates a user-access grant for a given domain"
    )
    @PermissionsAllowed(CalmHubScopes.GLOBAL_ADMIN) // TODO domain level admin scope needed
    public Response createUserAccessForDomain(@PathParam("domain") String domain,
                                              UserAccess createUserAccessRequest) {

        createUserAccessRequest.setCreationDateTime(LocalDateTime.now());
        createUserAccessRequest.setUpdateDateTime(LocalDateTime.now());

        if (!domain.equals(createUserAccessRequest.getDomain())) {
            logger.error("Request contains an invalid domain [{}]", createUserAccessRequest.getDomain());
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Bad Request").build();
        }
        try {
            return locationResponse(store.createUserAccessForDomain(createUserAccessRequest));
        } catch (URISyntaxException ex) {
            logger.error("Failed to create user-access for domain: [{}]", domain, ex);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("System Malfunction failed to create user-access").build();
        }
    }

    @GET
    @Path("{domain}/user-access")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get user-access for a given domain",
            description = "Get user-access details for a given domain"
    )
    @PermissionsAllowed(CalmHubScopes.GLOBAL_ADMIN)
    public Response getUserAccessForDomain(@PathParam("domain") String domain) {
        try {
            return Response.ok(store.getUserAccessForDomain(domain)).build();
        } catch (UserAccessNotFoundException ex) {
            logger.error("User-access details not found for domain [{}]", domain, ex);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("No access permissions found")
                    .build();
        }
    }

    @GET
    @Path("{domain}/user-access/{userAccessId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get the user-access record for a given domain and Id",
            description = "Get user-access details for a given domain and Id"
    )
    @PermissionsAllowed(CalmHubScopes.GLOBAL_ADMIN)
    public Response getUserAccessForDomainAndId(@PathParam("domain") String domain,
                                                @PathParam("userAccessId") Integer userAccessId) {
        try {
            return Response.ok(store.getUserAccessForDomainAndId(domain, userAccessId)).build();
        } catch (UserAccessNotFoundException ex) {
            logger.error("User-access details not found for domain [{}] id [{}]", domain, userAccessId, ex);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("No access permissions found").build();
        }
    }

    private Response locationResponse(UserAccess userAccess) throws URISyntaxException {
        return Response.created(new URI(
                        String.format("/calm/domains/%s/user-access/%s", userAccess.getDomain(), userAccess.getUserAccessId())))
                .build();
    }
}
