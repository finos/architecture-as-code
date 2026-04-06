package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.finos.calm.domain.*;
import org.finos.calm.domain.architecture.ArchitectureRequest;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.frontcontroller.FrontControllerCreateRequest;
import org.finos.calm.domain.frontcontroller.FrontControllerUpdateRequest;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.security.PermittedScopes;
import org.finos.calm.store.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import static org.finos.calm.resources.ResourceValidationConstants.*;

/**
 * Front controller that provides a type-agnostic REST API for addressing resources
 * by human-readable custom IDs (slugs) instead of numeric IDs.
 *
 * <p>This resource lives alongside the existing type-specific resources (PatternResource,
 * ArchitectureResource, etc.) and dispatches to the same underlying stores.</p>
 */
@Path("/calm")
public class FrontControllerResource {

    private final Logger logger = LoggerFactory.getLogger(FrontControllerResource.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final ResourceMappingStore mappingStore;
    private final PatternStore patternStore;
    private final ArchitectureStore architectureStore;
    private final FlowStore flowStore;
    private final StandardStore standardStore;
    private final InterfaceStore interfaceStore;

    @ConfigProperty(name = "calm.hub.base-url")
    Optional<String> baseUrl;

    @Inject
    public FrontControllerResource(ResourceMappingStore mappingStore,
                                   PatternStore patternStore,
                                   ArchitectureStore architectureStore,
                                   FlowStore flowStore,
                                   StandardStore standardStore,
                                   InterfaceStore interfaceStore) {
        this.mappingStore = mappingStore;
        this.patternStore = patternStore;
        this.architectureStore = architectureStore;
        this.flowStore = flowStore;
        this.standardStore = standardStore;
        this.interfaceStore = interfaceStore;
    }

    @POST
    @Path("{namespace}/{customId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create or update a resource by custom ID",
            description = "First POST creates the resource at version 1.0.0. Subsequent POSTs require a changeType to bump the version."
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL})
    public Response createOrUpdateResource(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("customId") @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String customId,
            String requestBody
    ) throws URISyntaxException {
        try {
            ResourceMapping existing = mappingStore.getMapping(namespace, customId);
            return updateExistingResource(namespace, customId, existing, requestBody);
        } catch (MappingNotFoundException e) {
            return createNewResource(namespace, customId, requestBody);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating/updating resource", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @GET
    @Path("{namespace}/{customId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get the latest version of a resource by custom ID",
            description = "Resolves the custom ID to a resource and returns the latest version"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getLatestResource(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("customId") @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String customId
    ) {
        try {
            ResourceMapping mapping = mappingStore.getMapping(namespace, customId);
            List<String> versions = getVersionsForMapping(mapping);
            if (versions.isEmpty()) {
                return mappingNotFoundResponse(customId);
            }
            String latestVersion = getLatestVersion(versions);
            String json = getResourceJsonForVersion(mapping, latestVersion);
            return Response.ok(json).build();
        } catch (MappingNotFoundException e) {
            return mappingNotFoundResponse(customId);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting resource", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException | ArchitectureNotFoundException | FlowNotFoundException | StandardNotFoundException | InterfaceNotFoundException e) {
            return mappingNotFoundResponse(customId);
        } catch (Exception e) {
            logger.error("Error retrieving resource [{}] in namespace [{}]", STRICT_SANITIZATION_POLICY.sanitize(customId), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GET
    @Path("{namespace}/{customId}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get a specific version of a resource by custom ID",
            description = "Resolves the custom ID and returns the resource at the specified version"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response getResourceVersion(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("customId") @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String customId,
            @PathParam("version") @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version
    ) {
        try {
            ResourceMapping mapping = mappingStore.getMapping(namespace, customId);
            String json = getResourceJsonForVersion(mapping, version);
            return Response.ok(json).build();
        } catch (MappingNotFoundException e) {
            return mappingNotFoundResponse(customId);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting resource version", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException | ArchitectureNotFoundException | FlowNotFoundException | StandardNotFoundException | InterfaceNotFoundException e) {
            return mappingNotFoundResponse(customId);
        } catch (PatternVersionNotFoundException | ArchitectureVersionNotFoundException | FlowVersionNotFoundException | StandardVersionNotFoundException | InterfaceVersionNotFoundException e) {
            return invalidVersionResponse(version);
        } catch (Exception e) {
            logger.error("Error retrieving resource [{}] version [{}] in namespace [{}]", STRICT_SANITIZATION_POLICY.sanitize(customId), STRICT_SANITIZATION_POLICY.sanitize(version), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GET
    @Path("{namespace}/{customId}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List versions of a resource by custom ID",
            description = "Resolves the custom ID and returns all available versions"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response listResourceVersions(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("customId") @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String customId
    ) {
        try {
            ResourceMapping mapping = mappingStore.getMapping(namespace, customId);
            List<String> versions = getVersionsForMapping(mapping);
            List<String> sortedVersions = versions.stream()
                    .sorted(Comparator.comparing(SemverUtils::parseSortableVersion))
                    .toList();
            return Response.ok(new ValueWrapper<>(sortedVersions)).build();
        } catch (MappingNotFoundException e) {
            return mappingNotFoundResponse(customId);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when listing resource versions", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException | ArchitectureNotFoundException | FlowNotFoundException | StandardNotFoundException | InterfaceNotFoundException e) {
            return mappingNotFoundResponse(customId);
        } catch (Exception e) {
            logger.error("Error listing versions for [{}] in namespace [{}]", STRICT_SANITIZATION_POLICY.sanitize(customId), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GET
    @Path("{namespace}/mappings")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Look up resource mappings",
            description = "Returns all resource mappings for a namespace, optionally filtered by type and/or numeric ID"
    )
    @PermittedScopes({CalmHubScopes.ARCHITECTURES_ALL, CalmHubScopes.ARCHITECTURES_READ})
    public Response lookupMappings(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @QueryParam("type") String type,
            @QueryParam("id") Integer numericId
    ) {
        try {
            ResourceType typeFilter = parseResourceType(type);

            if (numericId != null && typeFilter == null) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("Query parameter 'type' is required when 'id' is provided").build();
            }

            if (numericId != null && typeFilter != null) {
                try {
                    ResourceMapping mapping = mappingStore.getMappingByNumericId(namespace, typeFilter, numericId);
                    return Response.ok(new ValueWrapper<>(List.of(mapping))).build();
                } catch (MappingNotFoundException e) {
                    return Response.ok(new ValueWrapper<>(List.of())).build();
                }
            }

            List<ResourceMapping> mappings = mappingStore.listMappings(namespace, typeFilter);
            return Response.ok(new ValueWrapper<>(mappings)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when looking up mappings", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    // --- Private helpers ---

    private Response createNewResource(String namespace, String customId, String requestBody) throws URISyntaxException {
        FrontControllerCreateRequest request;
        try {
            request = OBJECT_MAPPER.readValue(requestBody, FrontControllerCreateRequest.class);
        } catch (JsonProcessingException e) {
            return invalidJsonResponse("Cannot parse request body");
        }

        if (request.getType() == null || request.getType().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Field 'type' is required for initial creation").build();
        }
        if (request.getJson() == null || request.getJson().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Field 'json' is required").build();
        }

        ResourceType resourceType;
        try {
            resourceType = ResourceType.valueOf(request.getType().toUpperCase());
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invalid resource type: " + STRICT_SANITIZATION_POLICY.sanitize(request.getType())).build();
        }

        String version = "1.0.0";
        String rewrittenJson = rewriteId(request.getJson(), namespace, customId, version);
        String name = request.getName() != null ? request.getName() : "";
        String description = request.getDescription() != null ? request.getDescription() : "";

        try {
            // Reserve the mapping first to prevent duplicate-create races
            mappingStore.createMapping(namespace, customId, resourceType, 0);
            try {
                int numericId = createResourceInStore(resourceType, namespace, rewrittenJson, name, description);
                mappingStore.updateMappingNumericId(namespace, customId, numericId);
            } catch (Exception e) {
                // Rollback the mapping reservation on resource creation failure
                try {
                    mappingStore.deleteMapping(namespace, customId);
                } catch (Exception rollbackEx) {
                    logger.error("Failed to rollback mapping for [{}] in namespace [{}]", STRICT_SANITIZATION_POLICY.sanitize(customId), STRICT_SANITIZATION_POLICY.sanitize(namespace), rollbackEx);
                }
                throw e;
            }
            URI location = new URI("/calm/" + namespace + "/" + customId + "/versions/" + version);
            return Response.created(location).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating resource", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (DuplicateMappingException e) {
            return Response.status(Response.Status.CONFLICT).entity("Custom ID already exists in namespace: " + STRICT_SANITIZATION_POLICY.sanitize(customId)).build();
        } catch (Exception e) {
            logger.error("Error creating resource [{}] in namespace [{}]", STRICT_SANITIZATION_POLICY.sanitize(customId), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.BAD_REQUEST).entity("Failed to create resource: " + STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
        }
    }

    private Response updateExistingResource(String namespace, String customId, ResourceMapping mapping, String requestBody) throws URISyntaxException {
        FrontControllerUpdateRequest request;
        try {
            request = OBJECT_MAPPER.readValue(requestBody, FrontControllerUpdateRequest.class);
        } catch (JsonProcessingException e) {
            return invalidJsonResponse("Cannot parse request body");
        }

        if (request.getChangeType() == null || request.getChangeType().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Field 'changeType' is required for updates (MAJOR, MINOR, or PATCH)").build();
        }
        if (request.getJson() == null || request.getJson().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Field 'json' is required").build();
        }

        try {
            List<String> versions = getVersionsForMapping(mapping);
            String latestVersion = getLatestVersion(versions);
            String newVersion = SemverUtils.bumpVersion(latestVersion, request.getChangeType());
            String rewrittenJson = rewriteId(request.getJson(), namespace, customId, newVersion);

            createVersionedResourceInStore(mapping.getResourceType(), namespace, mapping.getNumericId(), newVersion, rewrittenJson);

            URI location = new URI("/calm/" + namespace + "/" + customId + "/versions/" + newVersion);
            return Response.created(location).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invalid changeType: " + STRICT_SANITIZATION_POLICY.sanitize(request.getChangeType()) + ". Must be MAJOR, MINOR, or PATCH").build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when updating resource", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (Exception e) {
            logger.error("Error updating resource [{}] in namespace [{}]", STRICT_SANITIZATION_POLICY.sanitize(customId), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.BAD_REQUEST).entity("Failed to update resource: " + STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
        }
    }

    /**
     * Creates a new resource in the type-specific store and returns the assigned numeric ID.
     */
    private int createResourceInStore(ResourceType type, String namespace, String json, String name, String description) throws Exception {
        return switch (type) {
            case PATTERN -> {
                CreatePatternRequest req = new CreatePatternRequest(name, description, json);
                Pattern created = patternStore.createPatternForNamespace(req, namespace);
                yield created.getId();
            }
            case ARCHITECTURE -> {
                Architecture arch = new Architecture.ArchitectureBuilder()
                        .setNamespace(namespace)
                        .setArchitecture(json)
                        .setVersion("1.0.0")
                        .setName(name)
                        .setDescription(description)
                        .build();
                Architecture created = architectureStore.createArchitectureForNamespace(arch);
                yield created.getId();
            }
            case FLOW -> {
                CreateFlowRequest req = new CreateFlowRequest(name, description, json);
                Flow created = flowStore.createFlowForNamespace(req, namespace);
                yield created.getId();
            }
            case STANDARD -> {
                CreateStandardRequest req = new CreateStandardRequest(name, description, json);
                Standard created = standardStore.createStandardForNamespace(req, namespace);
                yield created.getId();
            }
            case INTERFACE -> {
                CreateInterfaceRequest req = new CreateInterfaceRequest(name, description, json);
                CalmInterface created = interfaceStore.createInterfaceForNamespace(req, namespace);
                yield created.getId();
            }
        };
    }

    /**
     * Creates a new version of an existing resource in the type-specific store.
     */
    private void createVersionedResourceInStore(ResourceType type, String namespace, int numericId, String version, String json) throws Exception {
        switch (type) {
            case PATTERN -> {
                Pattern pattern = new Pattern.PatternBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setPattern(json)
                        .build();
                patternStore.createPatternForVersion(pattern);
            }
            case ARCHITECTURE -> {
                Architecture arch = new Architecture.ArchitectureBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setArchitecture(json)
                        .build();
                architectureStore.createArchitectureForVersion(arch);
            }
            case FLOW -> {
                Flow flow = new Flow.FlowBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setFlow(json)
                        .build();
                flowStore.createFlowForVersion(flow);
            }
            case STANDARD -> {
                CreateStandardRequest req = new CreateStandardRequest("", "", json);
                standardStore.createStandardForVersion(req, namespace, numericId, version);
            }
            case INTERFACE -> {
                CreateInterfaceRequest req = new CreateInterfaceRequest("", "", json);
                interfaceStore.createInterfaceForVersion(req, namespace, numericId, version);
            }
        }
    }

    /**
     * Gets all versions for a resource mapping, dispatching to the appropriate store.
     */
    private List<String> getVersionsForMapping(ResourceMapping mapping) throws Exception {
        return switch (mapping.getResourceType()) {
            case PATTERN -> {
                Pattern pattern = new Pattern.PatternBuilder()
                        .setNamespace(mapping.getNamespace())
                        .setId(mapping.getNumericId())
                        .build();
                yield patternStore.getPatternVersions(pattern);
            }
            case ARCHITECTURE -> {
                Architecture arch = new Architecture.ArchitectureBuilder()
                        .setNamespace(mapping.getNamespace())
                        .setId(mapping.getNumericId())
                        .build();
                yield architectureStore.getArchitectureVersions(arch);
            }
            case FLOW -> {
                Flow flow = new Flow.FlowBuilder()
                        .setNamespace(mapping.getNamespace())
                        .setId(mapping.getNumericId())
                        .build();
                yield flowStore.getFlowVersions(flow);
            }
            case STANDARD -> standardStore.getStandardVersions(mapping.getNamespace(), mapping.getNumericId());
            case INTERFACE -> interfaceStore.getInterfaceVersions(mapping.getNamespace(), mapping.getNumericId());
        };
    }

    /**
     * Gets the JSON for a specific version of a resource, dispatching to the appropriate store.
     */
    private String getResourceJsonForVersion(ResourceMapping mapping, String version) throws Exception {
        return switch (mapping.getResourceType()) {
            case PATTERN -> {
                Pattern pattern = new Pattern.PatternBuilder()
                        .setNamespace(mapping.getNamespace())
                        .setId(mapping.getNumericId())
                        .setVersion(version)
                        .build();
                yield patternStore.getPatternForVersion(pattern);
            }
            case ARCHITECTURE -> {
                Architecture arch = new Architecture.ArchitectureBuilder()
                        .setNamespace(mapping.getNamespace())
                        .setId(mapping.getNumericId())
                        .setVersion(version)
                        .build();
                yield architectureStore.getArchitectureForVersion(arch);
            }
            case FLOW -> {
                Flow flow = new Flow.FlowBuilder()
                        .setNamespace(mapping.getNamespace())
                        .setId(mapping.getNumericId())
                        .setVersion(version)
                        .build();
                yield flowStore.getFlowForVersion(flow);
            }
            case STANDARD -> standardStore.getStandardForVersion(mapping.getNamespace(), mapping.getNumericId(), version);
            case INTERFACE -> interfaceStore.getInterfaceForVersion(mapping.getNamespace(), mapping.getNumericId(), version);
        };
    }

    /**
     * Rewrites the $id field in the JSON to use the friendly URL.
     */
    private String rewriteId(String json, String namespace, String customId, String version) {
        try {
            JsonNode tree = OBJECT_MAPPER.readTree(json);
            if (tree.isObject()) {
                String friendlyUrl = baseUrl.orElse("") + "/calm/" + namespace + "/" + customId + "/versions/" + version;
                ((ObjectNode) tree).put("$id", friendlyUrl);
                return OBJECT_MAPPER.writeValueAsString(tree);
            }
        } catch (JsonProcessingException e) {
            logger.warn("Could not rewrite $id in JSON, using original", e);
        }
        return json;
    }

    /**
     * Finds the latest version from a list of semver strings by sorting.
     */
    private String getLatestVersion(List<String> versions) {
        return versions.stream()
                .max(Comparator.comparing(SemverUtils::parseSortableVersion))
                .orElse("1.0.0");
    }

    private ResourceType parseResourceType(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        try {
            return ResourceType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Response mappingNotFoundResponse(String customId) {
        return Response.status(Response.Status.NOT_FOUND).entity("Resource mapping not found: " + STRICT_SANITIZATION_POLICY.sanitize(customId)).build();
    }

    private Response invalidJsonResponse(String message) {
        return Response.status(Response.Status.BAD_REQUEST).entity("Invalid JSON: " + message).build();
    }

    private Response invalidVersionResponse(String version) {
        return Response.status(Response.Status.NOT_FOUND).entity("Invalid version provided: " + version).build();
    }
}
