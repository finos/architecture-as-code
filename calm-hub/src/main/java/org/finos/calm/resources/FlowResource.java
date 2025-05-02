package org.finos.calm.resources;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.FlowStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;

@Path("/calm/namespaces")
public class FlowResource {

    private final FlowStore store;

    private final Logger logger = LoggerFactory.getLogger(FlowResource.class);

    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    Boolean allowPutOperations;

    public FlowResource(FlowStore store) {
        this.store = store;
    }

    @GET
    @Path("{namespace}/flows")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve flows in a given namespace",
            description = "Flows stored in a given namespace"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getFlowsForNamespace(@PathParam("namespace") String namespace) {
        try {
            return Response.ok(new ValueWrapper<>(store.getFlowsForNamespace(namespace))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when retrieving flows", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/flows")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create flow for namespace",
            description = "Creates a flow for a given namespace with an allocated ID and version 1.0.0"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createFlowForNamespace(@PathParam("namespace") String namespace, String flowJson) throws URISyntaxException {
        Flow flow = new Flow.FlowBuilder()
                .setNamespace(namespace)
                .setFlow(flowJson)
                .build();

        try {

            Flow flowForNamespace = store.createFlowForNamespace(flow);
            return flowWithLocationResponse(flowForNamespace);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating flow", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (JsonParseException e) {
            logger.error("Cannot parse Architecture JSON for namespace [{}]. Architecture JSON : [{}]", namespace, flowJson, e);
            return invalidFlowJsonResponse(namespace);
        }
    }

    @GET
    @Path("{namespace}/flows/{flowId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve the latest flow version",
            description = "Fetch the latest version of the flow by flowId"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getLatestFlow(@PathParam("namespace") String namespace, @PathParam("flowId") int flowId) {
        Flow flow = new Flow.FlowBuilder()
                .setNamespace(namespace)
                .setId(flowId)
                .build();

        try {
            List<String> versions =  store.getFlowVersions(flow);
            String lastVersion = versions.getLast();
           return getFlowInternal(namespace,flowId, lastVersion);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting the latest flow version", namespace, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (FlowNotFoundException e) {
            logger.error("Invalid flow [{}] when getting the latest flow version", flowId, e);
            return invalidFlowResponse(flowId);
        }
    }


    @GET
    @Path("{namespace}/flows/{flowId}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a list of versions for a given flow",
            description = "Flow versions are not opinionated, outside of the first version created"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getFlowVersions(@PathParam("namespace") String namespace, @PathParam("flowId") int flowId) {
        Flow flow = new Flow.FlowBuilder()
                .setNamespace(namespace)
                .setId(flowId)
                .build();

        try {
            return Response.ok(new ValueWrapper<>(store.getFlowVersions(flow))).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting versions of flow", flow, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (FlowNotFoundException e) {
            logger.error("Invalid flow [{}] when getting versions of flow", flow, e);
            return invalidFlowResponse(flowId);
        }
    }

    @GET
    @Path("{namespace}/flows/{flowId}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Retrieve a specific flow at a given version",
            description = "Retrieve flows at a specific version"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getFlow(@PathParam("namespace") String namespace, @PathParam("flowId") int flowId, @PathParam("version") String version) {
        return getFlowInternal(namespace, flowId, version);
    }

    private Response getFlowInternal(String namespace, int flowId, String version) {
        Flow flow = new Flow.FlowBuilder()
                .setNamespace(namespace)
                .setId(flowId)
                .setVersion(version)
                .build();

        try {
            return Response.ok(store.getFlowForVersion(flow)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting a flow", flow, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (FlowNotFoundException e) {
            logger.error("Invalid flow [{}] when getting a flow", flow, e);
            return invalidFlowResponse(flowId);
        } catch (FlowVersionNotFoundException e) {
            logger.error("Invalid version [{}] when getting a flow", flow, e);
            return invalidVersionResponse(version);
        }
    }

    @POST
    @Path("{namespace}/flows/{flowId}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createVersionedFlow(@PathParam("namespace") String namespace, @PathParam("flowId") int flowId,
                                        @PathParam("version") String version, String flowJson) throws URISyntaxException {
        Flow flow = new Flow.FlowBuilder()
                .setNamespace(namespace)
                .setId(flowId)
                .setVersion(version)
                .setFlow(flowJson)
                .build();

        try {
            store.createFlowForVersion(flow);
            return flowWithLocationResponse(flow);
        } catch (FlowVersionExistsException e) {
            logger.error("Flow version already exists [{}] when trying to create new flow", flow, e);
            return Response.status(Response.Status.CONFLICT).entity("Version already exists: " + version).build();
        } catch (FlowNotFoundException e) {
            logger.error("Invalid flow [{}] when getting a flow", flow, e);
            return invalidFlowResponse(flowId);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting a flow", flow, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @PUT
    @Path("{namespace}/flows/{flowId}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Updates a Flow (if available)",
            description = "In mutable version stores flow updates are supported by this endpoint, operation unavailable returned in repositories without configuration specified"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response updateVersionedFlow(@PathParam("namespace") String namespace, @PathParam("flowId") int flowId,
                                        @PathParam("version") String version, String flowJson) throws URISyntaxException {
        Flow flow = new Flow.FlowBuilder()
                .setNamespace(namespace)
                .setId(flowId)
                .setVersion(version)
                .setFlow(flowJson)
                .build();

        if (!allowPutOperations) {
            return Response.status(Response.Status.FORBIDDEN).entity("This Calm Hub does not support PUT operations").build();
        }

        try {
            store.updateFlowForVersion(flow);
            return flowWithLocationResponse(flow);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when trying to put flow", flow, e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (FlowNotFoundException e) {
            logger.error("Invalid flow [{}] when trying to put flow", flow, e);
            return invalidFlowResponse(flowId);
        }
    }

    private Response flowWithLocationResponse(Flow flow) throws URISyntaxException {
        return Response.created(new URI("/calm/namespaces/" + flow.getNamespace() + "/flows/" + flow.getId() + "/versions/" + flow.getDotVersion())).build();
    }

    private Response invalidFlowJsonResponse(String flowJson) {
        return Response.status(Response.Status.BAD_REQUEST).entity("The flow JSON could not be parsed: " + flowJson).build();
    }

    private Response invalidFlowResponse(int flowId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid flow provided: " + flowId).build();
    }

    private Response invalidVersionResponse(String version) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid version provided: " + version).build();
    }
}
