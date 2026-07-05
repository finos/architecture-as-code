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
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;

import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;

@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/domains")
public class DomainUserAccessResource {

    private final UserAccessStore store;
    private final DomainStore domainStore;
    private final Logger logger = LoggerFactory.getLogger(DomainUserAccessResource.class);

    public DomainUserAccessResource(UserAccessStore userAccessStore, DomainStore domainStore) {
        this.store = userAccessStore;
        this.domainStore = domainStore;
    }

    @POST
    @Path("{domain}/user-access")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create user access for domain",
            description = "Creates a user-access grant for a given domain"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_ADMIN)
    public Response createUserAccessForDomain(@PathParam("domain") @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE) String domain,
                                              @Valid @NotNull UserAccessRequest request) {

        if (!domainStore.domainExists(domain)) {
            return invalidDomainResponse(domain);
        }
        if ("*".equals(request.getUsername()) && request.getPermission() == UserAccess.Permission.admin) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Wildcard username is not permitted for admin permission on a domain")
                    .build();
        }
        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setDomain(domain)
                .setUsername(request.getUsername())
                .setPermission(request.getPermission())
                .build();
        userAccess.setCreationDateTime(LocalDateTime.now());
        userAccess.setUpdateDateTime(LocalDateTime.now());
        try {
            return locationResponse(store.createUserAccessForDomain(userAccess));
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
    @PermissionsAllowed(CalmHubScopes.DOMAIN_ADMIN)
    public Response getUserAccessForDomain(@PathParam("domain") @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE) String domain) {
        if (!domainStore.domainExists(domain)) {
            return invalidDomainResponse(domain);
        }
        return Response.ok(store.getUserAccessForDomain(domain)).build();
    }

    @GET
    @Path("{domain}/user-access/{userAccessId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get the user-access record for a given domain and Id",
            description = "Get user-access details for a given domain and Id"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_ADMIN)
    public Response getUserAccessForDomainAndId(@PathParam("domain") @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE) String domain,
                                                @PathParam("userAccessId") @NotNull Integer userAccessId) {
        if (!domainStore.domainExists(domain)) {
            return invalidDomainResponse(domain);
        }
        try {
            return Response.ok(store.getUserAccessForDomainAndId(domain, userAccessId)).build();
        } catch (UserAccessNotFoundException ex) {
            logger.error("User-access details not found for domain [{}] id [{}]", domain, userAccessId, ex);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("No access permissions found").build();
        }
    }

    @DELETE
    @Path("{domain}/user-access/{userAccessId}")
    @Operation(
            summary = "Revoke a domain user-access grant",
            description = "Deletes the user-access record for the given domain and id"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_ADMIN)
    public Response deleteUserAccessForDomain(@PathParam("domain") @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE) String domain,
                                              @PathParam("userAccessId") @NotNull Integer userAccessId) {
        if (!domainStore.domainExists(domain)) {
            return invalidDomainResponse(domain);
        }
        try {
            store.deleteUserAccessForDomain(domain, userAccessId);
            return Response.noContent().build();
        } catch (UserAccessNotFoundException ex) {
            logger.error("User-access record [{}] not found in domain [{}]", userAccessId, domain, ex);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("No access permissions found").build();
        }
    }

    private Response invalidDomainResponse(String domain) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Invalid domain provided: " + STRICT_SANITIZATION_POLICY.sanitize(domain))
                .build();
    }

    private Response locationResponse(UserAccess userAccess) throws URISyntaxException {
        return Response.created(new URI(
                        String.format("/api/calm/domains/%s/user-access/%s", userAccess.getDomain(), userAccess.getUserAccessId())))
                .build();
    }
}
