package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.store.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static org.finos.calm.resources.ResourceValidationConstants.*;

/**
 * Name-based resource controller for the CALM Hub.
 *
 * <p>Exposes CALM resources (patterns, architectures, flows, standards, interfaces) at
 * human-readable URLs under {@code /calm/namespaces/{namespace}/{type}/{name}}.  A mapping
 * from the friendly name to the underlying MongoDB numeric ID is maintained transparently.</p>
 *
 * <p>The document's {@code $id} drives the version. Three write endpoints are provided:</p>
 * <ul>
 *   <li>{@code POST /calm} — the {@code $id} must equal the versioned canonical URL
 *       ({@code {baseUrl}/calm/namespaces/{namespace}/{type}/{name}/versions/{version}}).
 *       A version is always required; for a brand-new resource the first version must be
 *       {@code 1.0.0}.  For an existing resource the requested version is created
 *       ({@code 409 Conflict} if it already exists).</li>
 *   <li>{@code POST /calm/namespaces/{namespace}/{type}/{name}/versions/{version}} — the
 *       {@code $id} must equal the canonical versioned URL for the exact version in the path.
 *       For a brand-new resource the version must be {@code 1.0.0}; for an existing resource the
 *       requested version is created ({@code 409 Conflict} if it already exists).</li>
 *   <li>{@code PUT /calm} — updates an existing version in place. The {@code $id} must equal
 *       the versioned canonical URL of the version to replace. Only available when
 *       {@code allow.put.operations=true}; returns {@code 403 Forbidden} otherwise.</li>
 * </ul>
 * <p>{@code calm.hub.base-url} is required and is used to build the canonical URL the {@code $id}
 * is validated against.</p>
 */
@Tag(name = "User Facing API", description = "Name-based (slug) CALM resource endpoints")
@Path("/calm")
public class MappingControllerResource {

    private final Logger logger = LoggerFactory.getLogger(MappingControllerResource.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /** Maps the plural URL path segment to the canonical {@link ResourceType}. */
    private static final Map<String, ResourceType> TYPE_MAP = Map.of(
            "patterns",      ResourceType.PATTERN,
            "architectures", ResourceType.ARCHITECTURE,
            "flows",         ResourceType.FLOW,
            "standards",     ResourceType.STANDARD,
            "interfaces",    ResourceType.INTERFACE
    );

    /** Maps {@link ResourceType} back to its plural URL segment. */
    private static final Map<ResourceType, String> TYPE_PLURAL_MAP = Map.of(
            ResourceType.PATTERN,      "patterns",
            ResourceType.ARCHITECTURE, "architectures",
            ResourceType.FLOW,         "flows",
            ResourceType.STANDARD,     "standards",
            ResourceType.INTERFACE,    "interfaces"
    );

    private final ResourceMappingStore mappingStore;
    private final PatternStore patternStore;
    private final ArchitectureStore architectureStore;
    private final FlowStore flowStore;
    private final StandardStore standardStore;
    private final InterfaceStore interfaceStore;

    @ConfigProperty(name = "calm.hub.base-url", defaultValue = "http://localhost:8080")
    String baseUrl;

    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    Boolean allowPutOperations;

    @Inject
    public MappingControllerResource(ResourceMappingStore mappingStore,
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

    // =========================================================================
    // POST /calm – create or add a specific version, reading all params from $id
    // =========================================================================

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create or add a version to a resource from document $id",
            description = "The request body must be the raw CALM document whose \"$id\" equals the versioned " +
                    "canonical URL: {baseUrl}/calm/namespaces/{namespace}/{type}/{name}/versions/{version}. " +
                    "A version is always required. For a brand-new resource the first version must be 1.0.0. " +
                    "For an existing resource the requested version is created (409 if it already exists)."
    )
    @Authenticated
    public Response createResourceFromDocument(String requestBody) throws URISyntaxException {
        if (requestBody == null || requestBody.isBlank()) {
            return invalidJsonResponse("Request body is required");
        }
        CanonicalId canonical;
        try {
            canonical = parseCanonicalId(requestBody);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
        } catch (JsonProcessingException e) {
            return invalidJsonResponse("Cannot parse request body as JSON");
        }
        String storedBody = stripId(requestBody);
        VersionSpec versionSpec = new VersionSpec(canonical.version(), true);
        try {
            ResourceMapping existing;
            try {
                existing = mappingStore.getMapping(canonical.namespace(), canonical.name());
            } catch (MappingNotFoundException ignored) {
                existing = null;
            }
            if (existing == null) {
                return createNewResource(canonical.namespace(), canonical.resourceType(),
                        canonical.type(), canonical.name(), storedBody, versionSpec);
            } else {
                return addNewVersion(canonical.namespace(), canonical.type(), canonical.name(),
                        existing, storedBody, versionSpec);
            }
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating/updating resource from document",
                    STRICT_SANITIZATION_POLICY.sanitize(canonical.namespace()), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(canonical.namespace());
        }
    }

    // =========================================================================
    // PUT /calm – update an existing resource version in place (if enabled)
    // =========================================================================

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Update a resource version in place (if PUT is enabled)",
            description = "Only available when allow.put.operations=true. The request body must be the raw CALM " +
                    "document whose \"$id\" equals the versioned canonical URL of the version to replace. " +
                    "Returns 403 Forbidden when PUT operations are disabled. " +
                    "Returns 501 Not Implemented for standards and interfaces."
    )
    @Authenticated
    public Response updateResourceFromDocument(String requestBody) throws URISyntaxException {
        if (!allowPutOperations) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("This Calm Hub does not support PUT operations").build();
        }
        if (requestBody == null || requestBody.isBlank()) {
            return invalidJsonResponse("Request body is required");
        }
        CanonicalId canonical;
        try {
            canonical = parseCanonicalId(requestBody);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
        } catch (JsonProcessingException e) {
            return invalidJsonResponse("Cannot parse request body as JSON");
        }
        if (canonical.resourceType() == ResourceType.STANDARD
                || canonical.resourceType() == ResourceType.INTERFACE) {
            return Response.status(Response.Status.NOT_IMPLEMENTED)
                    .entity("PUT is not supported for resource type: " + canonical.type()).build();
        }
        ResourceMapping existing;
        try {
            existing = mappingStore.getMapping(canonical.namespace(), canonical.name());
        } catch (MappingNotFoundException e) {
            return mappingNotFoundResponse(canonical.name());
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when looking up resource for PUT",
                    STRICT_SANITIZATION_POLICY.sanitize(canonical.namespace()), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(canonical.namespace());
        }
        String storedBody = stripId(requestBody);
        try {
            updateVersionedResourceInStore(canonical.resourceType(), canonical.namespace(),
                    existing.getNumericId(), canonical.version(), storedBody);
            URI location = new URI("/calm/namespaces/" + canonical.namespace() + "/" + canonical.type()
                    + "/" + canonical.name() + "/versions/" + canonical.version());
            return Response.created(location).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when updating resource via PUT",
                    STRICT_SANITIZATION_POLICY.sanitize(canonical.namespace()), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(canonical.namespace());
        } catch (Exception e) {
            logger.error("Error updating resource [{}] in namespace [{}] via PUT",
                    STRICT_SANITIZATION_POLICY.sanitize(canonical.name()),
                    STRICT_SANITIZATION_POLICY.sanitize(canonical.namespace()), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =========================================================================
    // POST – create a specific version of a named resource
    // =========================================================================

    @POST
    @Path("namespaces/{namespace}/{type}/{name}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create a specific version of a named resource",
            description = "The request body must be the raw CALM document, and its \"$id\" must equal the canonical " +
                    "versioned URL for the exact version in the path. For a brand-new resource the version must be " +
                    "1.0.0; for an existing resource the requested version is created (409 if it already exists)."
    )
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createResourceVersion(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("type") String type,
            @PathParam("name") @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String name,
            @PathParam("version") @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            String requestBody
    ) throws URISyntaxException {
        return handlePost(namespace, type, name, version, requestBody);
    }

    /**
     * Shared POST handling for both the versionless and versioned endpoints.
     *
     * @param pathVersion the version taken from the URL path, or {@code null} for the versionless
     *                    endpoint.
     */
    private Response handlePost(String namespace, String type, String name, String pathVersion, String requestBody)
            throws URISyntaxException {
        ResourceType resourceType = parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)
                            + ". Supported: patterns, architectures, flows, standards, interfaces").build();
        }
        if ("versions".equals(name)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("'versions' is a reserved path segment and cannot be used as a resource name").build();
        }
        if (requestBody == null || requestBody.isBlank()) {
            return invalidJsonResponse("Request body is required");
        }

        VersionSpec versionSpec;
        try {
            versionSpec = resolveAndVerify(requestBody, namespace, type, name, pathVersion);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
        } catch (JsonProcessingException e) {
            return invalidJsonResponse("Cannot parse request body as JSON");
        }

        // The document's $id is verified above, but it must not be persisted: MongoDB rejects a
        // top-level "$id" field (a reserved DBRef key) and the canonical $id is re-applied on GET.
        String storedBody = stripId(requestBody);

        try {
            ResourceMapping existing;
            try {
                existing = mappingStore.getMapping(namespace, name);
            } catch (MappingNotFoundException ignored) {
                existing = null;
            }
            if (existing == null) {
                return createNewResource(namespace, resourceType, type, name, storedBody, versionSpec);
            } else {
                return addNewVersion(namespace, type, name, existing, storedBody, versionSpec);
            }
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating/updating resource",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    // =========================================================================
    // GET – latest version
    // =========================================================================

    @GET
    @Path("namespaces/{namespace}/{type}/{name}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get the latest version of a named resource",
            description = "Resolves the name to its underlying resource and returns the latest version. " +
                    "The \"$id\" in the returned document is rewritten to the versionless canonical URL."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getLatestResource(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("type") String type,
            @PathParam("name") @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String name
    ) {
        ResourceType resourceType = parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)).build();
        }
        if ("versions".equals(name)) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        try {
            ResourceMapping mapping = mappingStore.getMapping(namespace, name);
            List<String> versions = getVersionsForMapping(mapping);
            if (versions.isEmpty()) {
                return mappingNotFoundResponse(name);
            }
            String latestVersion = getLatestVersion(versions);
            String json = getResourceJsonForVersion(mapping, latestVersion);
            String rewrittenJson = rewriteId(json, namespace, type, name, null);
            return Response.ok(rewrittenJson).build();
        } catch (MappingNotFoundException e) {
            return mappingNotFoundResponse(name);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting resource",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException | ArchitectureNotFoundException | FlowNotFoundException
                 | StandardNotFoundException | InterfaceNotFoundException e) {
            return mappingNotFoundResponse(name);
        } catch (Exception e) {
            logger.error("Error retrieving resource [{}] in namespace [{}]",
                    STRICT_SANITIZATION_POLICY.sanitize(name), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =========================================================================
    // GET – list all versions
    // =========================================================================

    @GET
    @Path("namespaces/{namespace}/{type}/{name}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List all versions of a named resource",
            description = "Returns all available semver versions for the named resource, sorted ascending."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response listResourceVersions(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("type") String type,
            @PathParam("name") @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String name
    ) {
        ResourceType resourceType = parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)).build();
        }
        try {
            ResourceMapping mapping = mappingStore.getMapping(namespace, name);
            List<String> versions = getVersionsForMapping(mapping);
            List<String> sortedVersions = versions.stream()
                    .sorted(Comparator.comparing(Semver::tryParse))
                    .toList();
            return Response.ok(new ValueWrapper<>(sortedVersions)).build();
        } catch (MappingNotFoundException e) {
            return mappingNotFoundResponse(name);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when listing resource versions",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException | ArchitectureNotFoundException | FlowNotFoundException
                 | StandardNotFoundException | InterfaceNotFoundException e) {
            return mappingNotFoundResponse(name);
        } catch (Exception e) {
            logger.error("Error listing versions for [{}] in namespace [{}]",
                    STRICT_SANITIZATION_POLICY.sanitize(name), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =========================================================================
    // GET – specific version
    // =========================================================================

    @GET
    @Path("namespaces/{namespace}/{type}/{name}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get a specific version of a named resource",
            description = "Returns the resource at the specified semver version. " +
                    "The \"$id\" in the returned document is rewritten to the versioned canonical URL."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getResourceVersion(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("type") String type,
            @PathParam("name") @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String name,
            @PathParam("version") @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version
    ) {
        ResourceType resourceType = parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)).build();
        }
        try {
            ResourceMapping mapping = mappingStore.getMapping(namespace, name);
            String json = getResourceJsonForVersion(mapping, version);
            String rewrittenJson = rewriteId(json, namespace, type, name, version);
            return Response.ok(rewrittenJson).build();
        } catch (MappingNotFoundException e) {
            return mappingNotFoundResponse(name);
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting resource version",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException | ArchitectureNotFoundException | FlowNotFoundException
                 | StandardNotFoundException | InterfaceNotFoundException e) {
            return mappingNotFoundResponse(name);
        } catch (PatternVersionNotFoundException | ArchitectureVersionNotFoundException
                 | FlowVersionNotFoundException | StandardVersionNotFoundException
                 | InterfaceVersionNotFoundException e) {
            return invalidVersionResponse(version);
        } catch (Exception e) {
            logger.error("Error retrieving resource [{}] version [{}] in namespace [{}]",
                    STRICT_SANITIZATION_POLICY.sanitize(name), STRICT_SANITIZATION_POLICY.sanitize(version),
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
    }

    // =========================================================================
    // GET – list all named resources of a type
    // =========================================================================

    @GET
    @Path("namespaces/{namespace}/{type}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List all named resources of a given type in a namespace",
            description = "Returns the resource mappings (name → numeric ID) for all named resources of the given type."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response listNamedResources(
            @PathParam("namespace") @jakarta.validation.constraints.Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("type") String type
    ) {
        ResourceType resourceType = parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)).build();
        }
        try {
            List<ResourceMapping> mappings = mappingStore.listMappings(namespace, resourceType);
            return Response.ok(new ValueWrapper<>(mappings)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when listing named resources",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Creates a brand-new resource (no mapping exists yet).
     * <p>The underlying stores always initialise the first version as {@code 1.0.0}.  The first
     * version of a resource must therefore be {@code 1.0.0}; any other requested version is
     * rejected with {@code 400 Bad Request}.</p>
     */
    private Response createNewResource(String namespace, ResourceType resourceType, String typePath,
                                       String name, String json, VersionSpec versionSpec) throws URISyntaxException {
        String finalVersion = versionSpec.version() != null ? versionSpec.version() : "1.0.0";
        if (!"1.0.0".equals(finalVersion)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("The first version of a resource must be 1.0.0, but " + finalVersion + " was requested")
                    .build();
        }
        try {
            mappingStore.createMapping(namespace, name, resourceType, 0);
            try {
                int numericId = createResourceInStore(resourceType, namespace, json, "", "");
                mappingStore.updateMappingNumericId(namespace, name, numericId);
            } catch (Exception e) {
                try {
                    mappingStore.deleteMapping(namespace, name);
                } catch (Exception rollbackEx) {
                    logger.error("Failed to rollback mapping for [{}] in namespace [{}]",
                            STRICT_SANITIZATION_POLICY.sanitize(name),
                            STRICT_SANITIZATION_POLICY.sanitize(namespace), rollbackEx);
                }
                throw e;
            }
            URI location = new URI("/calm/namespaces/" + namespace + "/" + typePath + "/" + name + "/versions/" + finalVersion);
            return Response.created(location).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating resource",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (DuplicateMappingException e) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("Resource name already exists in namespace: " + STRICT_SANITIZATION_POLICY.sanitize(name)).build();
        } catch (Exception e) {
            logger.error("Error creating resource [{}] in namespace [{}]",
                    STRICT_SANITIZATION_POLICY.sanitize(name), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            String errorMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Failed to create resource: " + STRICT_SANITIZATION_POLICY.sanitize(errorMsg)).build();
        }
    }

    /**
     * Adds a new version to an existing resource.
     * <p>The version from the {@code $id} or path is always used explicitly;
     * returns {@code 409} if the version already exists.</p>
     */
    private Response addNewVersion(String namespace, String typePath, String name,
                                   ResourceMapping mapping, String json, VersionSpec versionSpec) throws URISyntaxException {
        try {
            List<String> versions = getVersionsForMapping(mapping);
            if (versions.isEmpty()) {
                return mappingNotFoundResponse(name);
            }
            // Reject if the explicit version already exists.
            if (versions.contains(versionSpec.version())) {
                return Response.status(Response.Status.CONFLICT)
                        .entity("Version " + versionSpec.version() + " already exists for resource: "
                                + STRICT_SANITIZATION_POLICY.sanitize(name)).build();
            }
            String newVersion = versionSpec.version();
            createVersionedResourceInStore(mapping.getResourceType(), namespace,
                    mapping.getNumericId(), newVersion, json);

            URI location = new URI("/calm/namespaces/" + namespace + "/" + typePath + "/" + name + "/versions/" + newVersion);
            return Response.created(location).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when updating resource",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (Exception e) {
            logger.error("Error updating resource [{}] in namespace [{}]",
                    STRICT_SANITIZATION_POLICY.sanitize(name), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            String errorMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Failed to update resource: " + STRICT_SANITIZATION_POLICY.sanitize(errorMsg)).build();
        }
    }

    /**
     * Verifies the document's {@code $id} against the canonical versioned URL for this resource.
     *
     * <ul>
     *   <li>{@code $id} is mandatory; a missing or blank {@code $id} is rejected.</li>
     *   <li>The {@code $id} must equal the canonical versioned URL for the exact version in the
     *       path ({@code pathVersion} is always non-null for the versioned endpoint).</li>
     * </ul>
     *
     * @throws IllegalArgumentException if the {@code $id} is missing or does not match.
     * @throws JsonProcessingException  if the body cannot be parsed as JSON.
     */
    private VersionSpec resolveAndVerify(String json, String namespace, String typePath, String name,
                                         String pathVersion) throws JsonProcessingException {
        JsonNode tree = OBJECT_MAPPER.readTree(json);
        String id = null;
        if (tree.isObject()) {
            JsonNode idNode = tree.get("$id");
            if (idNode != null && !idNode.isNull()) {
                id = idNode.asText();
            }
        }
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("$id is required");
        }
        String normalizedBase = baseUrl.trim();
        if (normalizedBase.endsWith("/")) {
            normalizedBase = normalizedBase.substring(0, normalizedBase.length() - 1);
        }
        String expected = normalizedBase + "/calm/namespaces/" + namespace + "/" + typePath + "/" + name
                + "/versions/" + pathVersion;
        if (!id.equals(expected)) {
            throw new IllegalArgumentException("$id does not match the expected URL. Expected: " + expected);
        }
        return new VersionSpec(pathVersion, true);
    }

    /**
     * Creates a new resource in the type-specific store and returns the assigned numeric ID.
     * The underlying stores always initialise the first stored version as {@code 1.0.0}.
     */
    private int createResourceInStore(ResourceType type, String namespace, String json,
                                       String resourceName, String description) throws Exception {
        return switch (type) {
            case PATTERN -> {
                CreatePatternRequest req = new CreatePatternRequest(resourceName, description, json);
                Pattern created = patternStore.createPatternForNamespace(req, namespace);
                yield created.getId();
            }
            case ARCHITECTURE -> {
                Architecture arch = new Architecture.ArchitectureBuilder()
                        .setNamespace(namespace)
                        .setArchitecture(json)
                        .setVersion("1.0.0")
                        .setName(resourceName)
                        .setDescription(description)
                        .build();
                Architecture created = architectureStore.createArchitectureForNamespace(arch);
                yield created.getId();
            }
            case FLOW -> {
                CreateFlowRequest req = new CreateFlowRequest(resourceName, description, json);
                Flow created = flowStore.createFlowForNamespace(req, namespace);
                yield created.getId();
            }
            case STANDARD -> {
                CreateStandardRequest req = new CreateStandardRequest(resourceName, description, json);
                Standard created = standardStore.createStandardForNamespace(req, namespace);
                yield created.getId();
            }
            case INTERFACE -> {
                CreateInterfaceRequest req = new CreateInterfaceRequest(resourceName, description, json);
                CalmInterface created = interfaceStore.createInterfaceForNamespace(req, namespace);
                yield created.getId();
            }
        };
    }

    /**
     * Creates a new version of an existing resource in the type-specific store.
     */
    private void createVersionedResourceInStore(ResourceType type, String namespace, int numericId,
                                                 String version, String json) throws Exception {
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
     * Returns all version strings for the resource referenced by the mapping.
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
     * Retrieves the JSON for a specific version of a resource.
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
     * Removes the top-level {@code $id} field from the document before persistence.
     *
     * <p>MongoDB rejects a top-level {@code $id} field (a reserved DBRef key), and the canonical
     * {@code $id} is re-applied on every GET via {@link #rewriteId}, so the submitted value does
     * not need to be stored.</p>
     */
    private String stripId(String json) {
        try {
            JsonNode tree = OBJECT_MAPPER.readTree(json);
            if (tree.isObject()) {
                ((ObjectNode) tree).remove("$id");
                return OBJECT_MAPPER.writeValueAsString(tree);
            }
        } catch (JsonProcessingException e) {
            logger.warn("Could not strip $id from JSON, using original", e);
        }
        return json;
    }

    /**
     * Rewrites the {@code $id} field in the returned JSON to the canonical URL.
     *
     * @param version {@code null} for the versionless (latest) form;
     *                a semver string for the versioned form.
     */
    private String rewriteId(String json, String namespace, String typePath, String name, String version) {
        String configuredBaseUrl = baseUrl == null ? null : baseUrl.trim();
        if (configuredBaseUrl == null || configuredBaseUrl.isEmpty()) {
            return json;
        }
        try {
            JsonNode tree = OBJECT_MAPPER.readTree(json);
            if (tree.isObject()) {
                String normalizedBase = configuredBaseUrl.endsWith("/")
                        ? configuredBaseUrl.substring(0, configuredBaseUrl.length() - 1)
                        : configuredBaseUrl;
                String canonicalUrl = normalizedBase + "/calm/namespaces/" + namespace + "/" + typePath + "/" + name;
                if (version != null) {
                    canonicalUrl = canonicalUrl + "/versions/" + version;
                }
                ((ObjectNode) tree).put("$id", canonicalUrl);
                return OBJECT_MAPPER.writeValueAsString(tree);
            }
        } catch (JsonProcessingException e) {
            logger.warn("Could not rewrite $id in JSON, using original", e);
        }
        return json;
    }

    /** Selects the highest semver from a list of version strings. */
    private String getLatestVersion(List<String> versions) {
        return versions.stream()
                .max(Comparator.comparing(Semver::tryParse))
                .orElse("1.0.0");
    }

    /** Maps a plural URL path segment (e.g. {@code "patterns"}) to the corresponding {@link ResourceType}. */
    private ResourceType parseTypePlural(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        return TYPE_MAP.get(type.toLowerCase());
    }

    private Response mappingNotFoundResponse(String name) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Resource not found: " + STRICT_SANITIZATION_POLICY.sanitize(name)).build();
    }

    private Response invalidJsonResponse(String message) {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity("Invalid JSON: " + message).build();
    }

    private Response invalidVersionResponse(String version) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Invalid version provided: " + version).build();
    }

    /**
     * Carries the version determined from the document's {@code $id} or path.
     *
     * @param version  the version string (always non-null; a version is always required).
     * @param explicit always {@code true}; kept for compatibility with existing call-sites.
     */
    private record VersionSpec(String version, boolean explicit) {}

    /**
     * Parsed representation of a fully-qualified versioned canonical {@code $id}.
     */
    private record CanonicalId(String namespace, ResourceType resourceType, String type, String name, String version) {}

    /**
     * Parses and validates the document's {@code $id} field, extracting namespace, resource type,
     * name, and version from the canonical URL.
     *
     * <p>The {@code $id} must match
     * {@code {baseUrl}/calm/namespaces/{namespace}/{type}/{name}/versions/{version}}.
     * A versionless or missing {@code $id} is rejected with {@link IllegalArgumentException}.</p>
     *
     * @throws IllegalArgumentException if the {@code $id} is missing, malformed, or versionless.
     * @throws JsonProcessingException  if the body cannot be parsed as JSON.
     */
    private CanonicalId parseCanonicalId(String json) throws JsonProcessingException {
        JsonNode tree = OBJECT_MAPPER.readTree(json);
        String id = null;
        if (tree.isObject()) {
            JsonNode idNode = tree.get("$id");
            if (idNode != null && !idNode.isNull()) {
                id = idNode.asText();
            }
        }
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("$id is required");
        }
        String normalizedBase = baseUrl == null ? "" : baseUrl.trim();
        if (normalizedBase.endsWith("/")) {
            normalizedBase = normalizedBase.substring(0, normalizedBase.length() - 1);
        }
        String expectedPrefix = normalizedBase + "/calm/namespaces/";
        if (!id.startsWith(expectedPrefix)) {
            throw new IllegalArgumentException(
                    "$id must start with: " + expectedPrefix + "{namespace}/{type}/{name}/versions/{version}");
        }
        // remainder: {namespace}/{type}/{name}/versions/{version}
        String remainder = id.substring(expectedPrefix.length());
        String[] parts = remainder.split("/", -1);
        // Minimum: namespace, type, name, "versions", version → 5 parts
        if (parts.length < 5 || !"versions".equals(parts[3])) {
            throw new IllegalArgumentException(
                    "$id must include a version: " + expectedPrefix
                            + "{namespace}/{type}/{name}/versions/{version}");
        }
        String namespace = parts[0];
        String type = parts[1];
        String name = parts[2];
        String version = parts[4];
        if (!namespace.matches(NAMESPACE_REGEX)) {
            throw new IllegalArgumentException("Invalid namespace in $id: " + namespace);
        }
        if (!name.matches(CUSTOM_ID_REGEX)) {
            throw new IllegalArgumentException("Invalid resource name in $id: " + name);
        }
        if ("versions".equals(name)) {
            throw new IllegalArgumentException("'versions' is a reserved path segment and cannot be used as a resource name");
        }
        if (!version.matches(VERSION_REGEX)) {
            throw new IllegalArgumentException("Invalid version in $id: " + version);
        }
        ResourceType resourceType = TYPE_MAP.get(type.toLowerCase());
        if (resourceType == null) {
            throw new IllegalArgumentException(
                    "Unsupported resource type in $id: " + type
                            + ". Supported: patterns, architectures, flows, standards, interfaces");
        }
        return new CanonicalId(namespace, resourceType, type, name, version);
    }

    /**
     * Updates an existing version of a resource in the type-specific store.
     * Supported for {@link ResourceType#PATTERN}, {@link ResourceType#ARCHITECTURE},
     * and {@link ResourceType#FLOW} only.
     */
    private void updateVersionedResourceInStore(ResourceType type, String namespace, int numericId,
                                                String version, String json) throws Exception {
        switch (type) {
            case PATTERN -> {
                Pattern pattern = new Pattern.PatternBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setPattern(json)
                        .build();
                patternStore.updatePatternForVersion(pattern);
            }
            case ARCHITECTURE -> {
                Architecture arch = new Architecture.ArchitectureBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setArchitecture(json)
                        .build();
                architectureStore.updateArchitectureForVersion(arch);
            }
            case FLOW -> {
                Flow flow = new Flow.FlowBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setFlow(json)
                        .build();
                flowStore.updateFlowForVersion(flow);
            }
            default -> throw new UnsupportedOperationException("Update not supported for resource type: " + type);
        }
    }
}
