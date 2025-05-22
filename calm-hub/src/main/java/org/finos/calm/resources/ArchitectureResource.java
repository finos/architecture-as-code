package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.ArchitectureStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;

/**
 * Resource for managing architectures in a given namespace
 */
@Path("/calm/namespaces")
public class ArchitectureResource {

    private final ArchitectureStore store;

    private final Logger logger = LoggerFactory.getLogger(ArchitectureResource.class);

    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    Boolean allowPutOperations;

    @Inject
    public ArchitectureResource(ArchitectureStore store) {
        this.store = store;
    }

    /**
     * Retrieve a list of architectures in a given namespace
     * @param namespace the namespace to retrieve architectures for
     * @return a list of architectures in the given namespace
     */
    @GET
    @Path("{namespace}/architectures")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve architectures in a given namespace",
            description = "Architecture stored in a given namespace"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getArchitecturesForNamespace(@PathParam("namespace") String namespace) {
        try {
            return Response.ok(new ValueWrapper<>(store.getArchitecturesForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving architectures", namespace, e);
            return invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/architectures")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create architecture for namespace",
            description = "Creates a architecture for a given namespace with an allocated ID and version 1.0.0"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createArchitectureForNamespace(@PathParam("namespace") String namespace, String architectureJson) throws URISyntaxException {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setArchitecture(architectureJson)
                .build();

        try {
            return architectureWithLocationResponse(store.createArchitectureForNamespace(architecture));
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating architecture", namespace, e);
            return invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Architecture JSON for namespace [{}]. Architecture JSON : [{}]", namespace, architectureJson, e);
            return invalidArchitectureJsonResponse(namespace);
        }
    }

    @GET
    @Path("{namespace}/architectures/{architectureId}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a list of versions for a given architecture",
            description = "Architecture versions are not opinionated, outside of the first version created"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getArchitectureVersions(@PathParam("namespace") String namespace, @PathParam("architectureId") int architectureId) {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(architectureId)
                .build();

        try {
            return Response.ok(new ValueWrapper<>(store.getArchitectureVersions(architecture))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting versions of architecture", architecture, e);
            return invalidNamespaceResponse(namespace);
        } catch (ArchitectureNotFoundException e) {
            logger.error("Invalid architecture [{}] when getting versions of architecture", architecture, e);
            return invalidArchitectureResponse(architectureId);
        }
    }

    @GET
    @Path("{namespace}/architectures/{architectureId}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a specific architecture at a given version",
            description = "Retrieve architectures at a specific version"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getArchitecture(@PathParam("namespace") String namespace, @PathParam("architectureId") int architectureId, @PathParam("version") String version) {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(architectureId)
                .setVersion(version)
                .build();

        try {
            return Response.ok(store.getArchitectureForVersion(architecture)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting an architecture", architecture, e);
            return invalidNamespaceResponse(namespace);
        } catch (ArchitectureNotFoundException e) {
            logger.error("Invalid architecture [{}] when getting an architecture", architecture, e);
            return invalidArchitectureResponse(architectureId);
        } catch (ArchitectureVersionNotFoundException e) {
            logger.error("Invalid version [{}] when getting an architecture", architecture, e);
            return invalidVersionResponse(version);
        }
    }

    @POST
    @Path("{namespace}/architectures/{architectureId}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createVersionedArchitecture(@PathParam("namespace") String namespace, @PathParam("architectureId") int architectureId, @PathParam("version") String version, String architectureJson) throws URISyntaxException {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(architectureId)
                .setVersion(version)
                .setArchitecture(architectureJson)
                .build();

        try {
            store.createArchitectureForVersion(architecture);
            return architectureWithLocationResponse(architecture);
        } catch (ArchitectureVersionExistsException e) {
            logger.error("Architecture version already exists [{}] when trying to create new architecture", architecture, e);
            return Response.status(Response.Status.CONFLICT).entity("Version already exists: " + version).build();
        } catch (ArchitectureNotFoundException e) {
            logger.error("Invalid architecture [{}] when getting an architecture", architecture, e);
            return invalidArchitectureResponse(architectureId);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting an architecture", architecture, e);
            return invalidNamespaceResponse(namespace);
        }
    }

    @PUT
    @Path("{namespace}/architectures/{architectureId}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Updates an architecture (if available)",
            description = "In mutable version stores architecture updates are supported by this endpoint, operation unavailable returned in repositories without configuration specified"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response updateVersionedArchitecture(@PathParam("namespace") String namespace, @PathParam("architectureId") int architectureId, @PathParam("version") String version, String architectureJson) throws URISyntaxException {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(architectureId)
                .setVersion(version)
                .setArchitecture(architectureJson)
                .build();

        if(!allowPutOperations) {
            return Response.status(Response.Status.FORBIDDEN).entity("This Calm Hub does not support PUT operations on architectures").build();
        }

        try {
            store.updateArchitectureForVersion(architecture);
            return architectureWithLocationResponse(architecture);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when trying to put architecture", architecture, e);
            return invalidNamespaceResponse(namespace);
        } catch (ArchitectureNotFoundException e) {
            logger.error("Invalid architecture [{}] when trying to put architecture", architecture, e);
            return invalidArchitectureResponse(architectureId);
        }


    }

    private Response architectureWithLocationResponse(Architecture architecture) throws URISyntaxException {
        return Response.created(new URI("/calm/namespaces/" + architecture.getNamespace() + "/architectures/" + architecture.getId() + "/versions/" + architecture.getDotVersion())).build();
    }

    private Response invalidNamespaceResponse(String namespace) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid namespace provided: " + namespace).build();
    }

    private Response invalidArchitectureJsonResponse(String architectureJson) {
        return Response.status(Response.Status.BAD_REQUEST).entity("The architecture JSON could not be parsed: " + architectureJson).build();
    }

    private Response invalidArchitectureResponse(int architectureId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid architecture provided: " + architectureId).build();
    }

    private Response invalidVersionResponse(String version) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid version provided: " + version).build();
    }
}
