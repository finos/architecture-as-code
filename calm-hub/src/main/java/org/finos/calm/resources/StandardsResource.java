package org.finos.calm.resources;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.StandardsStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;

@Path("calm/namespaces")
public class StandardsResource {

    private final StandardsStore standardsStore;

    private final Logger logger = LoggerFactory.getLogger(StandardsStore.class);

    public StandardsResource(StandardsStore standardsStore) {
        this.standardsStore = standardsStore;
    }

    @GET
    @Path("{namespace}/standards")
    @Produces(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getStandardsForNamespace(@PathParam("namespace") String namespace) {
        try {
            return Response.ok(new ValueWrapper<>(standardsStore.getStandardsForNamespace(namespace))).build();
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
            Standard createdStandard = standardsStore.createStandardForNamespace(namespace, standard);
            return Response.created(new URI("/calm/namespaces/" + namespace + "/standards/" + createdStandard.getId() + "/versions/1.0.0")).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating standard", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }
}
