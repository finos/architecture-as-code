package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.inject.Inject;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.architecture.ArchitectureRequest;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.ArchitectureTimelineService;
import org.finos.calm.store.ArchitectureStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_REGEX;


/**
 * Resource for managing architectures in a given namespace
 */
@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
@Authenticated
public class ArchitectureResource {

    private final ArchitectureStore store;
    private final ArchitectureTimelineService timelineService;

    private final Logger logger = LoggerFactory.getLogger(ArchitectureResource.class);

    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    Boolean allowPutOperations;

    @Inject
    public ArchitectureResource(ArchitectureStore store, ArchitectureTimelineService timelineService) {
        this.store = store;
        this.timelineService = timelineService;
    }

    /**
     * Retrieve a list of architectures in a given namespace
     *
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
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getArchitecturesForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace
    ) {
        try {
            return Response.ok(new ValueWrapper<>(store.getArchitecturesForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving architectures", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
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
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createArchitectureForNamespace(
            @PathParam("namespace")
            @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            ArchitectureRequest architectureRequest
    ) throws URISyntaxException {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setDescription(architectureRequest.getDescription())
                .setName(architectureRequest.getName())
                .setArchitecture(architectureRequest.getArchitectureJson())
                .build();

        try {
            return architectureWithLocationResponse(store.createArchitectureForNamespace(architecture));
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating architecture", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Architecture JSON for namespace [{}]. Architecture JSON : [{}]", namespace, STRICT_SANITIZATION_POLICY.sanitize(architectureRequest.getArchitectureJson()), e);
            return CalmResourceErrorResponses.invalidJsonResponse("architecture");
        }
    }

    @GET
    @Path("{namespace}/architectures/{architectureId}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a list of versions for a given architecture",
            description = "Architecture versions are not opinionated, outside of the first version created"
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getArchitectureVersions(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("architectureId") int architectureId
    ) {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(architectureId)
                .build();

        try {
            return Response.ok(new ValueWrapper<>(store.getArchitectureVersions(architecture))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting versions of architecture", architecture, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
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
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getArchitecture(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("architectureId") int architectureId,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version) {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(architectureId)
                .setVersion(version)
                .build();

        try {
            return Response.ok(store.getArchitectureForVersion(architecture)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting an architecture", architecture, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
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
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createVersionedArchitecture(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("architectureId") int architectureId,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            ArchitectureRequest architectureRequest
    ) throws URISyntaxException {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(architectureId)
                .setVersion(version)
                .setName(architectureRequest.getName())
                .setDescription(architectureRequest.getDescription())
                .setArchitecture(architectureRequest.getArchitectureJson())
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
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Architecture JSON for namespace [{}]. Architecture JSON : [{}]", namespace, STRICT_SANITIZATION_POLICY.sanitize(architectureRequest.getArchitectureJson()), e);
            return CalmResourceErrorResponses.invalidJsonResponse("architecture");
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
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response updateVersionedArchitecture(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("architectureId") int architectureId,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            ArchitectureRequest architectureRequest) throws URISyntaxException {
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(architectureId)
                .setVersion(version)
                .setName(architectureRequest.getName())
                .setDescription(architectureRequest.getDescription())
                .setArchitecture(architectureRequest.getArchitectureJson())
                .build();

        if (!allowPutOperations) {
            return Response.status(Response.Status.FORBIDDEN).entity("This Calm Hub does not support PUT operations on architectures").build();
        }

        try {
            store.updateArchitectureForVersion(architecture);
            return architectureWithLocationResponse(architecture);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when trying to put architecture", architecture, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ArchitectureNotFoundException e) {
            logger.error("Invalid architecture [{}] when trying to put architecture", architecture, e);
            return invalidArchitectureResponse(architectureId);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Architecture JSON for namespace [{}]. Architecture JSON : [{}]", namespace, STRICT_SANITIZATION_POLICY.sanitize(architectureRequest.getArchitectureJson()), e);
            return CalmResourceErrorResponses.invalidJsonResponse("architecture");
        }


    }

    @GET
    @Path("{namespace}/architectures/{architectureId}/timeline")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a timeline for a given architecture",
            description = "Returns the CALM timeline for an architecture. If an explicit timeline is linked to the "
                    + "architecture it is returned; otherwise an implied timeline projecting the architecture's "
                    + "version history is returned."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getArchitectureTimeline(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("architectureId") int architectureId
    ) {
        try {
            return Response.ok(timelineService.getTimelineForArchitecture(namespace, architectureId)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving architecture timeline", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ArchitectureNotFoundException e) {
            logger.error("Invalid architecture [{}] when retrieving architecture timeline", architectureId, e);
            return invalidArchitectureResponse(architectureId);
        } catch (JsonProcessingException e) {
            logger.error("Failed to serialise timeline for architecture [{}] in namespace [{}]", architectureId, namespace, e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity("Failed to build timeline for architecture: " + architectureId).build();
        }
    }

    private Response architectureWithLocationResponse(Architecture architecture) throws URISyntaxException {
        return Response.created(new URI("/api/calm/namespaces/" + architecture.getNamespace() + "/architectures/" + architecture.getId() + "/versions/" + architecture.getDotVersion())).build();
    }

    private Response invalidArchitectureResponse(int architectureId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid architecture provided: " + architectureId).build();
    }

    private Response invalidVersionResponse(String version) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid version provided: " + version).build();
    }
}