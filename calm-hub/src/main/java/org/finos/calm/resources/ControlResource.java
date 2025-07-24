package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;


/**
 * REST resource for managing domains.
 */
@Path("/calm/domains")
public class ControlResource {

    private final ControlStore store;

    private final Logger logger = LoggerFactory.getLogger(ControlResource.class);

    @Inject
    public ControlResource(ControlStore store) {
        this.store = store;
    }

    @GET
    @Produces("application/json")
    @Path("{domain}/controls")
    public Response getControlsForDomain(@PathParam("domain") String domain) {
        try {
            return Response.ok(store.getControlsForDomain(domain)).build();
        } catch (DomainNotFoundException domainNotFoundException) {
            logger.error("Invalid domain [{}] when retrieving controls", domain, domainNotFoundException);
            return Response.status(Response.Status.NOT_FOUND).entity("Invalid domain provided: " + domain).build();
        }
    }


}
