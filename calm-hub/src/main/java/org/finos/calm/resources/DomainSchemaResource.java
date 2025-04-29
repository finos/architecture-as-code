package org.finos.calm.resources;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;

import java.net.URI;
import java.net.URISyntaxException;

/**
 * REST resource for managing domains.
 */
@Path("/calm/controls/domains")
public class DomainSchemaResource {

    private final DomainStore store;

    /**
     * Constructor for DomainSchemaResource.
     *
     * @param store the DomainStore instance
     */
    public DomainSchemaResource(DomainStore store) {
        this.store = store;
    }

    /**
     * Retrieves the list of domains.
     *
     * @return a Response containing the list of domains
     */
    @GET
    @Produces("application/json")
    public Response getDomains() {
        return Response.ok(new ValueWrapper<>(store.getDomains())).build();
    }

    /**
     * Creates a new domain if it does not already exist and is of the correct structure
     * @param domain the domain to create
     * @return a Response indicating the result of the operation
     * @throws URISyntaxException if the URI syntax is incorrect
     */
    @POST
    @Produces("application/json")
    @Consumes("application/json")
    public Response createDomain(Domain domain) throws URISyntaxException {
        String domainName = domain.getName();
        //Validate that domain name is the correct format
        if(domainName == null || !domainName.matches("^[a-zA-Z0-9-]+$")) {
            return Response.status(Response.Status.BAD_REQUEST).entity("{\"error\":\"Invalid domain name\"}").build();
        }

        try {
            domain = store.createDomain(domain.getName());
        } catch (DomainAlreadyExistsException e) {
            return Response.status(Response.Status.CONFLICT).entity("{\"error\":\"Domain already exists\"}").build();
        }
        return Response.created(new URI("/calm/domains/" + domain.getName())).build();
    }

}
