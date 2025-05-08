package org.finos.calm.resources;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.StandardStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;

@Path("calm/namespaces")
public class StandardResource {

    private final StandardStore standardStore;

    private final Logger logger = LoggerFactory.getLogger(StandardStore.class);

    public StandardResource(StandardStore standardStore) {
        this.standardStore = standardStore;
    }

    @GET
    @Path("{namespace}/standards")
    @Produces(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getStandardsForNamespace(@PathParam("namespace") String namespace) {
        try {
            return Response.ok(new ValueWrapper<>(standardStore.getStandardsForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving architectures", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/standards")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response createStandardForNamespace(@PathParam("namespace") String namespace, Standard standard) throws URISyntaxException {
        try {
            standard.setNamespace(namespace);
            Standard createdStandard = standardStore.createStandardForNamespace(standard);
            return Response.created(new URI("/calm/namespaces/" + namespace + "/standards/" + createdStandard.getId() + "/versions/1.0.0")).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating standard", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @GET
    @Path("{namespace}/standards/{standardId}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getStandardVersions(@PathParam("namespace") String namespace, @PathParam("standardId") Integer standardId) {
        try {
            Standard standard = new Standard();
            standard.setNamespace(namespace);
            standard.setId(standardId);
            return Response.ok(new ValueWrapper<>(standardStore.getStandardVersions(standard))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving standard versions", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch(StandardNotFoundException e) {
            logger.error("Invalid standard [{}] when retrieving standard versions", standardId, e);
            return invalidStandardResponse(standardId);
        }
    }

    private Response invalidStandardResponse(int standardId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid standard provided: " + standardId).build();
    }
}
