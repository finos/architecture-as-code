package org.finos.calm.resources;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.Adr;
import org.finos.calm.domain.AdrBuilder;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;

/**
 * Resource for managing ADRs in a given namespace
 */
@Path("/calm/namespaces")
public class AdrResource {

    private final AdrStore store;
    private final Logger logger = LoggerFactory.getLogger(AdrResource.class);

    public AdrResource(AdrStore store) {
        this.store = store;
    }

    /**
     * Retrieve a list of ADRs in a given namespace
     * @param namespace the namespace to retrieve ADRs for
     * @return a list of ADRs in the given namespace
     */
    @GET
    @Path("{namespace}/adrs")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve ADRs in a given namespace",
            description = "ADRs stored in a given namespace"
    )
    public Response getAdrsForNamespace(@PathParam("namespace") String namespace) {
        try {
            return Response.ok(new ValueWrapper<>(store.getAdrsForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving ADRs", namespace, e);
            return invalidNamespaceResponse(namespace);
        }
    }


    @POST
    @Path("{namespace}/adrs")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create ADR for namespace",
            description = "Creates an ADR for a given namespace with an allocated ID and revision 1"
    )
    public Response createAdrForNamespace(@PathParam("namespace") String namespace, String adrJson) throws URISyntaxException {
        Adr adr = AdrBuilder.builder()
                .namespace(namespace)
                .revision(1)
                .adr(adrJson)
                .build();

        try {
            return adrWithLocationResponse(store.createAdrForNamespace(adr));
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating ADR", namespace, e);
            return invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Architecture JSON for namespace [{}]. Architecture JSON : [{}]", namespace, adrJson, e);
            return invalidAdrJsonResponse(namespace);
        }
    }

    private Response adrWithLocationResponse(Adr adr) throws URISyntaxException {
        return Response.created(new URI("/calm/namespaces/" + adr.namespace() + "/adrs/" + adr.id() + "/revisions/" + adr.revision())).build();
    }

    private Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid namespace provided: " + namespace).build();
    }

    private Response invalidAdrJsonResponse(String adrJson) {
        return Response.status(Response.Status.BAD_REQUEST).entity("The ADR JSON could not be parsed: " + adrJson).build();
    }
}
