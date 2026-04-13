package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.DomainStore;

import java.net.URI;

/**
 * REST resource for managing domains.
 */
@Path("/calm/domains")
public class DomainResource {

    private final DomainStore store;

    /**
     * Constructor for DomainSchemaResource.
     *
     * @param store the DomainStore instance
     */
    @Inject
    public DomainResource(DomainStore store) {
        this.store = store;
    }

    /**
     * Retrieves the list of domains.
     *
     * @return a Response containing the list of domains
     */
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Available Domains",
            description = "The available domains in this Calm Hub"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getDomains() {
        return Response.ok(new ValueWrapper<>(store.getDomains())).build();
    }

    /**
     * Creates a new domain if it does not already exist and is of the correct structure
     * @param domain the domain to create
     * @return a Response indicating the result of the operation
     */
    @POST
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create Domain",
            description = "Create a new domain in the Calm Hub"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createDomain(@Valid @NotNull(message = "Request must not be null") Domain domain) {
        String domainName = domain.getName();

        try {
            store.createDomain(domainName);
        } catch (DomainAlreadyExistsException e) {
            return Response.status(Response.Status.CONFLICT).entity("{\"error\":\"Domain already exists\"}").build();
        }
        return Response.created(URI.create("/calm/domains/" + domainName)).build();
    }

}
