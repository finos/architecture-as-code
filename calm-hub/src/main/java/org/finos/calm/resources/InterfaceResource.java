package org.finos.calm.resources;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.finos.calm.domain.Interface;
import org.finos.calm.domain.InterfaceRequest;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.InterfaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;

/**
 * Resource for managing interfaces in a given namespace
 */
@Path("/calm/namespaces")
public class InterfaceResource {

    private final Logger logger = LoggerFactory.getLogger(InterfaceResource.class);

    private final InterfaceStore interfaceStore;
    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    Boolean allowPutOperations;

    public InterfaceResource(InterfaceStore interfaceStore) {
        this.interfaceStore = interfaceStore;
    }

    @POST
    @Path("{namespace}/interfaces")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create architecture for namespace",
            description = "Creates an interface for a given namespace with an allocated ID, version, name and description"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createInterfaceForNamespace(@PathParam("namespace") String namespace,
                                                @RequestBody InterfaceRequest interfaceRequest) throws URISyntaxException {
        Interface interfaceToCreate = new Interface.InterfaceBuilder()
                .setNamespace(namespace)
                .setName(interfaceRequest.name())
                .setDescription(interfaceRequest.description())
                .setInterfaceJson(interfaceRequest.interfaceJson())
                .build();
        try {
            Interface createdInterface = interfaceStore.createInterfaceForNamespace(interfaceToCreate);
            return interfaceWithLocationResponse(createdInterface);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating interface", namespace, e);
            return invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Interface JSON for namespace [{}]. Interface JSON : [{}]", namespace, interfaceRequest.interfaceJson(), e);
            return invalidInterfaceJsonResponse(namespace);
        }
    }

    @GET
    @Path("{namespace}/interfaces")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve interfaces in a given namespace, response include unique id, name, and description",
            description = "Interfaces stored in a given namespace"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getInterfacesForNamespace(@PathParam("namespace") String namespace) {
        try {
            return Response.ok(new ValueWrapper<>(interfaceStore.getInterfacesForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving interfaces", namespace, e);
            return invalidNamespaceResponse(namespace);
        }
    }

    private Response interfaceWithLocationResponse(Interface interfaceContent) throws URISyntaxException {
        return Response.created(new URI("/calm/namespaces/" + interfaceContent.getNamespace() + "/interfaces/" + interfaceContent.getId() + "/versions/" + interfaceContent.getVersion())).build();
    }

    private Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid namespace provided: " + namespace).build();
    }

    private Response invalidInterfaceJsonResponse(String interfaceJson) {
        return Response.status(Response.Status.BAD_REQUEST).entity("The interface JSON could not be parsed: " + interfaceJson).build();
    }

}
