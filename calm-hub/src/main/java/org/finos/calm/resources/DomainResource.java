package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.DomainService;

import java.net.URI;

/**
 * REST resource for managing domains.
 */
@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/domains")
public class DomainResource {

    private final DomainService service;

    @Inject
    public DomainResource(DomainService service) {
        this.service = service;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Available Domains",
            description = "The available domains in this Calm Hub"
    )
    @Authenticated
    public Response getDomains() {
        return Response.ok(new ValueWrapper<>(service.getDomains())).build();
    }

    @POST
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create Domain",
            description = "Create a new domain in the Calm Hub"
    )
    @PermissionsAllowed(CalmHubScopes.GLOBAL_ADMIN)
    public Response createDomain(@Valid @NotNull(message = "Request must not be null") Domain domain) {
        String domainName = domain.getName();

        if (CalmHubPermissionChecker.GLOBAL_ACCESS.equalsIgnoreCase(domainName)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"'GLOBAL' is a reserved domain name\"}")
                    .build();
        }

        try {
            service.createDomain(domainName);
        } catch (DomainAlreadyExistsException e) {
            return Response.status(Response.Status.CONFLICT).entity("{\"error\":\"Domain already exists\"}").build();
        }
        return Response.created(URI.create("/api/calm/domains/" + domainName)).build();
    }

}
