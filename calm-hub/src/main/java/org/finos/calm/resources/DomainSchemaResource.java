package org.finos.calm.resources;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;

import java.net.URI;
import java.net.URISyntaxException;

@Path("/calm/domains")
public class DomainSchemaResource {

    private final DomainStore store;

    public DomainSchemaResource(DomainStore store) {
        this.store = store;
    }

    @GET
    @Produces("application/json")
    public Response getDomains() {
        return Response.ok(new ValueWrapper<>(store.getDomains())).build();
    }

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
