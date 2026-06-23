package org.finos.calm.resources;

import io.quarkus.security.PermissionsAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.store.TimelineStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;

import static org.finos.calm.resources.ResourceValidationConstants.*;

/**
 * Resource for managing explicit timelines in a given namespace.
 */
@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/namespaces")
public class TimelineResource {

    private final TimelineStore store;

    private final Logger logger = LoggerFactory.getLogger(TimelineResource.class);

    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    Boolean allowPutOperations;

    @Inject
    public TimelineResource(TimelineStore store) {
        this.store = store;
    }

    @GET
    @Path("{namespace}/timelines")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve timelines in a given namespace",
            description = "Timelines stored in a given namespace"
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getTimelinesForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace
    ) {
        try {
            return Response.ok(new ValueWrapper<>(store.getTimelinesForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving timelines", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/timelines")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create timeline for namespace",
            description = "Creates a timeline for a given namespace with an allocated ID and version 1.0.0"
    )
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createTimelineForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @Valid @NotNull(message = "Request must not be null") CreateTimelineRequest timelineRequest
    ) throws URISyntaxException {
        try {
            Timeline timelineForNamespace = store.createTimelineForNamespace(timelineRequest, namespace);
            return timelineWithLocationResponse(timelineForNamespace);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating timeline", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Timeline JSON for namespace [{}]. Timeline JSON : [{}]", namespace, STRICT_SANITIZATION_POLICY.sanitize(timelineRequest.getTimelineJson()), e);
            return CalmResourceErrorResponses.invalidJsonResponse("timeline");
        }
    }

    @GET
    @Path("{namespace}/timelines/{timelineId}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a list of versions for a given timeline",
            description = "Timeline versions are not opinionated, outside of the first version created"
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getTimelineVersions(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("timelineId") int timelineId
    ) {
        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(namespace)
                .setId(timelineId)
                .build();

        try {
            return Response.ok(new ValueWrapper<>(store.getTimelineVersions(timeline))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting versions of timeline", timeline, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (TimelineNotFoundException e) {
            logger.error("Invalid timeline [{}] when getting versions of timeline", timeline, e);
            return invalidTimelineResponse(timelineId);
        }
    }

    @GET
    @Path("{namespace}/timelines/{timelineId}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a specific timeline at a given version",
            description = "Retrieve timelines at a specific version"
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getTimeline(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("timelineId") int timelineId,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version
    ) {
        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(namespace)
                .setId(timelineId)
                .setVersion(version)
                .build();

        try {
            return Response.ok(store.getTimelineForVersion(timeline)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting a timeline", timeline, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (TimelineNotFoundException e) {
            logger.error("Invalid timeline [{}] when getting a timeline", timeline, e);
            return invalidTimelineResponse(timelineId);
        } catch (TimelineVersionNotFoundException e) {
            logger.error("Invalid version [{}] when getting a timeline", timeline, e);
            return invalidVersionResponse(version);
        }
    }

    @POST
    @Path("{namespace}/timelines/{timelineId}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create a new version of an existing timeline",
            description = "Stores a new version of the timeline under the supplied {version}. The request body is an envelope containing `name`, optional `description`, and the inner `timelineJson` document; only the inner document is persisted as the version contents."
    )
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createVersionedTimeline(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("timelineId") int timelineId,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            @Valid @NotNull(message = "Request must not be null") CreateTimelineRequest timelineRequest
    ) throws URISyntaxException {
        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(namespace)
                .setId(timelineId)
                .setVersion(version)
                .setName(timelineRequest.getName())
                .setDescription(timelineRequest.getDescription())
                .setTimeline(timelineRequest.getTimelineJson())
                .build();

        try {
            store.createTimelineForVersion(timeline);
            return timelineWithLocationResponse(timeline);
        } catch (TimelineVersionExistsException e) {
            logger.error("Timeline version already exists [{}] when trying to create new timeline", timeline, e);
            return Response.status(Response.Status.CONFLICT).entity("Version already exists: " + version).build();
        } catch (TimelineNotFoundException e) {
            logger.error("Invalid timeline [{}] when getting a timeline", timeline, e);
            return invalidTimelineResponse(timelineId);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting a timeline", timeline, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Timeline JSON for namespace [{}]. Timeline JSON : [{}]", namespace, STRICT_SANITIZATION_POLICY.sanitize(timelineRequest.getTimelineJson()), e);
            return CalmResourceErrorResponses.invalidJsonResponse("timeline");
        }
    }

    @PUT
    @Path("{namespace}/timelines/{timelineId}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Updates a Timeline (if available)",
            description = "In mutable version stores timeline updates are supported by this endpoint, operation unavailable returned in repositories without configuration specified. The request body uses the same envelope as POST."
    )
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response updateVersionedTimeline(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("timelineId") int timelineId,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            @Valid @NotNull(message = "Request must not be null") CreateTimelineRequest timelineRequest
    ) throws URISyntaxException {
        Timeline timeline = new Timeline.TimelineBuilder()
                .setNamespace(namespace)
                .setId(timelineId)
                .setVersion(version)
                .setName(timelineRequest.getName())
                .setDescription(timelineRequest.getDescription())
                .setTimeline(timelineRequest.getTimelineJson())
                .build();

        if (!allowPutOperations) {
            return Response.status(Response.Status.FORBIDDEN).entity("This Calm Hub does not support PUT operations").build();
        }

        try {
            store.updateTimelineForVersion(timeline);
            return timelineWithLocationResponse(timeline);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when trying to put timeline", timeline, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (TimelineNotFoundException e) {
            logger.error("Invalid timeline [{}] when trying to put timeline", timeline, e);
            return invalidTimelineResponse(timelineId);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Timeline JSON for namespace [{}]. Timeline JSON : [{}]", namespace, STRICT_SANITIZATION_POLICY.sanitize(timelineRequest.getTimelineJson()), e);
            return CalmResourceErrorResponses.invalidJsonResponse("timeline");
        }
    }

    private Response timelineWithLocationResponse(Timeline timeline) throws URISyntaxException {
        return Response.created(new URI("/api/calm/namespaces/" + timeline.getNamespace() + "/timelines/" + timeline.getId() + "/versions/" + timeline.getDotVersion())).build();
    }

    private Response invalidTimelineResponse(int timelineId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid timeline provided: " + timelineId).build();
    }

    private Response invalidVersionResponse(String version) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid version provided: " + version).build();
    }
}
