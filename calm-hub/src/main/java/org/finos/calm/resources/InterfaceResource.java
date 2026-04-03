package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.InterfaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_REGEX;

@Path("calm/namespaces")
public class InterfaceResource {

    private final InterfaceStore interfaceStore;

    private final Logger logger = LoggerFactory.getLogger(InterfaceResource.class);

    @Inject
    public InterfaceResource(InterfaceStore interfaceStore) {
        this.interfaceStore = interfaceStore;
    }

    @GET
    @Path("{namespace}/interfaces")
    @Produces(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getInterfacesForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace
    ) {
        try {
            return Response.ok(new ValueWrapper<>(interfaceStore.getInterfacesForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving interfaces", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/interfaces")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createInterfaceForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @Valid @NotNull(message = "Request must not be null") CreateInterfaceRequest interfaceRequest
    ) throws URISyntaxException {
        try {
            CalmInterface createdInterface = interfaceStore.createInterfaceForNamespace(interfaceRequest, namespace);
            return Response.created(new URI("/calm/namespaces/" + namespace + "/interfaces/" + createdInterface.getId() + "/versions/1.0.0")).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating interface", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse interface JSON for namespace [{}]", namespace, e);
            return invalidJsonResponse();
        }
    }

    @GET
    @Path("{namespace}/interfaces/{interfaceId}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getInterfaceVersions(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("interfaceId") Integer interfaceId
    ) {
        try {
            return Response.ok(new ValueWrapper<>(interfaceStore.getInterfaceVersions(namespace, interfaceId))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving interface versions", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (InterfaceNotFoundException e) {
            logger.error("Invalid interface [{}] when retrieving interface versions", interfaceId, e);
            return invalidInterfaceResponse(interfaceId);
        }
    }

    @GET
    @Path("{namespace}/interfaces/{interfaceId}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getInterfaceForVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("interfaceId") Integer interfaceId,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version
    ) {
        try {
            return Response.ok(interfaceStore.getInterfaceForVersion(namespace, interfaceId, version)).build();
        } catch (InterfaceNotFoundException e) {
            logger.error("Invalid interface [{}] when retrieving interface versions", interfaceId, e);
            return invalidInterfaceResponse(interfaceId);
        } catch (InterfaceVersionNotFoundException e) {
            logger.error("Invalid interface [{}] with invalid version [{}] when retrieving interface version", interfaceId, version, e);
            return invalidInterfaceVersionResponse(interfaceId, version);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving interface versions", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/interfaces/{interfaceId}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createInterfaceForVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("interfaceId") Integer interfaceId,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            @Valid @NotNull(message = "Request must not be null") CreateInterfaceRequest createInterfaceRequest
    ) throws URISyntaxException {
        try {
            interfaceStore.createInterfaceForVersion(createInterfaceRequest, namespace, interfaceId, version);
            return Response.created(new URI("/calm/namespaces/" + namespace + "/interfaces/" + interfaceId + "/versions/" + version)).build();
        } catch (InterfaceVersionExistsException e) {
            logger.error("Interface Version [{}] already exists", version, e);
            return Response.status(Response.Status.CONFLICT).entity("Interface version already exists: " + STRICT_SANITIZATION_POLICY.sanitize(version)).build();
        } catch (InterfaceNotFoundException e) {
            logger.error("Invalid interface [{}] when retrieving interface versions", interfaceId, e);
            return invalidInterfaceResponse(interfaceId);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving interface versions", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse interface JSON for interface [{}] in namespace [{}]", interfaceId, namespace, e);
            return invalidJsonResponse();
        }
    }

    private Response invalidInterfaceResponse(int interfaceId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid interface provided: " + interfaceId).build();
    }

    private Response invalidInterfaceVersionResponse(int interfaceId, String version) {
        return Response.status(Response.Status.NOT_FOUND).entity("Interface Version not found. ID [" + interfaceId
                + "] Version [" + STRICT_SANITIZATION_POLICY.sanitize(version) + "]").build();
    }

    private Response invalidJsonResponse() {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity("The provided JSON could not be parsed")
                .build();
    }
}
