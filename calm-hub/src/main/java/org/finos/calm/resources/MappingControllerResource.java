package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.*;
import org.finos.calm.domain.controls.ControlConfigDetail;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.*;
import org.finos.calm.security.CalmHubPermissionChecker;
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
import java.util.List;

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

    private final ResourceMappingStore mappingStore;
    private final PatternStore patternStore;
    private final ArchitectureStore architectureStore;
    private final FlowStore flowStore;
    private final StandardStore standardStore;
    private final InterfaceStore interfaceStore;
    private final DomainStore domainStore;
    private final ControlStore controlStore;
    private final CalmDocumentParser documentParser;
    private final CalmHubPermissionChecker permissionChecker;

    @Inject
    SecurityIdentity identity;

    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    Boolean allowPutOperations;

    @Inject
    public MappingControllerResource(ResourceMappingStore mappingStore,
                                   PatternStore patternStore,
                                   ArchitectureStore architectureStore,
                                   FlowStore flowStore,
                                   StandardStore standardStore,
                                   InterfaceStore interfaceStore,
                                   DomainStore domainStore,
                                   ControlStore controlStore,
                                   CalmDocumentParser documentParser,
                                   CalmHubPermissionChecker permissionChecker) {
        this.mappingStore = mappingStore;
        this.patternStore = patternStore;
        this.architectureStore = architectureStore;
        this.flowStore = flowStore;
        this.standardStore = standardStore;
        this.interfaceStore = interfaceStore;
        this.domainStore = domainStore;
        this.controlStore = controlStore;
        this.documentParser = documentParser;
        this.permissionChecker = permissionChecker;
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
                    "canonical URL. For namespace resources: {baseUrl}/calm/namespaces/{namespace}/{type}/{name}/versions/{version}. " +
                    "For control requirements: {baseUrl}/calm/domains/{domain}/controls/{controlName}/requirement/versions/{version}. " +
                    "For configurations: {baseUrl}/calm/domains/{domain}/controls/{controlName}/configurations/{configName}/versions/{version}. " +
                    "A version is always required. For a brand-new resource the first version must be 1.0.0. " +
                    "For an existing resource the requested version is created (409 if it already exists)."
    )
    @Authenticated
    public Response createResourceFromDocument(String requestBody) throws URISyntaxException {
        if (requestBody == null || requestBody.isBlank()) {
            return invalidJsonResponse("Request body is required");
        }

        // Dispatch based on $id prefix: /calm/domains/ = control/config; /calm/namespaces/ = namespace resource
        String idValue = documentParser.extractIdFromJson(requestBody);
        if (idValue != null && idValue.startsWith(documentParser.domainPrefix())) {
            CalmDocumentParser.DomainControlId domainId;
            try {
                domainId = documentParser.parseDomainControlId(requestBody);
            } catch (IllegalArgumentException e) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
            } catch (JsonProcessingException e) {
                return invalidJsonResponse("Cannot parse request body as JSON");
            }
            if (domainId instanceof CalmDocumentParser.ControlRequirementId r) {
                if (!permissionChecker.canWriteByDomain(identity, r.domain())) {
                    return Response.status(Response.Status.FORBIDDEN)
                            .entity("Insufficient permissions to write to domain: "
                                    + STRICT_SANITIZATION_POLICY.sanitize(r.domain())).build();
                }
                return handleControlRequirementPost(r.domain(), r.controlName(), r.version(), requestBody);
            } else if (domainId instanceof CalmDocumentParser.ControlConfigId c) {
                if (!permissionChecker.canWriteByDomain(identity, c.domain())) {
                    return Response.status(Response.Status.FORBIDDEN)
                            .entity("Insufficient permissions to write to domain: "
                                    + STRICT_SANITIZATION_POLICY.sanitize(c.domain())).build();
                }
                return handleControlConfigurationPost(c.domain(), c.controlName(), c.configName(), c.version(), requestBody);
            }
        }

        CalmDocumentParser.CanonicalId canonical;
        try {
            canonical = documentParser.parseCanonicalId(requestBody);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
        } catch (JsonProcessingException e) {
            return invalidJsonResponse("Cannot parse request body as JSON");
        }
        if (!permissionChecker.canWrite(identity, canonical.namespace())) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Insufficient permissions to write to namespace: "
                            + STRICT_SANITIZATION_POLICY.sanitize(canonical.namespace())).build();
        }
        CalmDocumentParser.VersionSpec versionSpec = new CalmDocumentParser.VersionSpec(canonical.version(), true);
        try {
            ResourceMapping existing;
            try {
                existing = mappingStore.getMapping(canonical.namespace(), canonical.name());
            } catch (MappingNotFoundException ignored) {
                existing = null;
            }
            if (existing == null) {
                return createNewResource(canonical.namespace(), canonical.resourceType(),
                        canonical.type(), canonical.name(), requestBody, versionSpec);
            } else {
                return addNewVersion(canonical.namespace(), canonical.type(), canonical.name(),
                        existing, requestBody, versionSpec);
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
        CalmDocumentParser.CanonicalId canonical;
        try {
            canonical = documentParser.parseCanonicalId(requestBody);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
        } catch (JsonProcessingException e) {
            return invalidJsonResponse("Cannot parse request body as JSON");
        }
        if (!permissionChecker.canWrite(identity, canonical.namespace())) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Insufficient permissions to write to namespace: "
                            + STRICT_SANITIZATION_POLICY.sanitize(canonical.namespace())).build();
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
        String storedBody = documentParser.stripId(requestBody);
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
        ResourceType resourceType = documentParser.parseTypePlural(type);
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

        CalmDocumentParser.VersionSpec versionSpec;
        try {
            versionSpec = documentParser.resolveAndVerify(requestBody, namespace, type, name, pathVersion);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
        } catch (JsonProcessingException e) {
            return invalidJsonResponse("Cannot parse request body as JSON");
        }

        try {
            ResourceMapping existing;
            try {
                existing = mappingStore.getMapping(namespace, name);
            } catch (MappingNotFoundException ignored) {
                existing = null;
            }
            if (existing == null) {
                return createNewResource(namespace, resourceType, type, name, requestBody, versionSpec);
            } else {
                return addNewVersion(namespace, type, name, existing, requestBody, versionSpec);
            }
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating/updating resource",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
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
        ResourceType resourceType = documentParser.parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)).build();
        }
        try {
            ResourceMapping mapping = mappingStore.getMapping(namespace, name);
            List<String> versions = getVersionsForMapping(mapping);
            List<String> sortedVersions = versions.stream()
                    .sorted(java.util.Comparator.comparing(org.finos.calm.domain.Semver::tryParse))
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
        ResourceType resourceType = documentParser.parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)).build();
        }
        try {
            ResourceMapping mapping = mappingStore.getMapping(namespace, name);
            String json = getResourceJsonForVersion(mapping, version);
            String rewrittenJson = documentParser.rewriteId(json, namespace, type, name, version);
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
        ResourceType resourceType = documentParser.parseTypePlural(type);
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
                                       String name, String json, CalmDocumentParser.VersionSpec versionSpec) throws URISyntaxException {
        String finalVersion = versionSpec.version() != null ? versionSpec.version() : "1.0.0";
        if (!"1.0.0".equals(finalVersion)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("The first version of a resource must be 1.0.0, but " + finalVersion + " was requested")
                    .build();
        }
        String title = documentParser.extractStringField(json, "title");
        if (title.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("'title' is required in the document body").build();
        }
        String description = documentParser.extractStringField(json, "description");
        try {
            mappingStore.createMapping(namespace, name, resourceType, 0);
            try {
                int numericId = createResourceInStore(resourceType, namespace, json, title, description);
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
                                   ResourceMapping mapping, String json, CalmDocumentParser.VersionSpec versionSpec) throws URISyntaxException {
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

    private Response mappingNotFoundResponse(String name) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Resource not found: " + STRICT_SANITIZATION_POLICY.sanitize(name)).build();
    }

    /**
     * Creates a new resource in the type-specific store and returns the assigned numeric ID.
     * The underlying stores always initialise the first stored version as {@code 1.0.0}.
     */
    private int createResourceInStore(ResourceType type, String namespace, String json,
                                       String resourceName, String description) throws Exception {
        // The $id was already verified against the canonical URL; strip it before storage as it is
        // re-derived on read and MongoDB rejects a top-level $id field (write error code 55).
        json = documentParser.stripId(json);
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
        // Strip the verified $id before storage (re-derived on read; Mongo rejects a top-level $id).
        json = documentParser.stripId(json);
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

    private Response invalidJsonResponse(String message) {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity("Invalid JSON: " + message).build();
    }

    private Response invalidVersionResponse(String version) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Invalid version provided: " + version).build();
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

    // =========================================================================
    // User Facing API — Domains (/calm/domains)
    // =========================================================================

    @GET
    @Path("domains")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List all domains",
            description = "Returns all domains available in CALM Hub"
    )
    @Authenticated
    public Response getDomains() {
        return Response.ok(new ValueWrapper<>(domainStore.getDomains())).build();
    }

    @POST
    @Path("domains")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create a domain",
            description = "Creates a new domain in CALM Hub"
    )
    @PermissionsAllowed(CalmHubScopes.GLOBAL_ADMIN)
    public Response createDomain(@Valid @NotNull(message = "Request must not be null") Domain domain) {
        String domainName = domain.getName();

        if (CalmHubPermissionChecker.GLOBAL_ACCESS.equalsIgnoreCase(domainName)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"'GLOBAL' is a reserved domain name\"}")
                    .build();
        }

        try {
            domainStore.createDomain(domainName);
        } catch (DomainAlreadyExistsException e) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("{\"error\":\"Domain already exists\"}")
                    .build();
        }
        return Response.created(URI.create("/calm/domains/" + domainName)).build();
    }

    // =========================================================================
    // User Facing API — Controls (/calm/domains/{domain}/controls)
    // =========================================================================

    @POST
    @Path("domains/{domain}/controls/{controlName}/requirement/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create a control requirement version",
            description = "Creates a new control (if it does not exist, version must be 1.0.0) or adds a new requirement " +
                    "version to an existing control. The body must include a \"$id\" matching the canonical URL for this path."
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_WRITE)
    public Response createRequirementVersion(
            @PathParam("domain")
            @jakarta.validation.constraints.Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("version")
            @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version,
            String requestBody) throws URISyntaxException {
        return handleControlRequirementPost(domain, controlName, version, requestBody);
    }

    @POST
    @Path("domains/{domain}/controls/{controlName}/configurations/{configName}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create a control configuration version",
            description = "Creates a new configuration (if it does not exist, version must be 1.0.0) or adds a new version " +
                    "to an existing configuration. The body must include a \"$id\" matching the canonical URL for this path."
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_WRITE)
    public Response createConfigurationVersion(
            @PathParam("domain")
            @jakarta.validation.constraints.Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("configName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String configName,
            @PathParam("version")
            @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version,
            String requestBody) throws URISyntaxException {
        return handleControlConfigurationPost(domain, controlName, configName, version, requestBody);
    }

    @GET
    @Path("domains/{domain}/controls")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List controls for a domain",
            description = "Returns all controls in the given domain"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getControlsForDomain(
            @PathParam("domain")
            @jakarta.validation.constraints.Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain) {
        try {
            return Response.ok(new ValueWrapper<>(controlStore.getControlsForDomain(domain))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when listing controls", domain, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        }
    }

    @GET
    @Path("domains/{domain}/controls/{controlName}/requirement/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List requirement versions for a named control",
            description = "Returns the list of requirement versions for the control with the given name"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getRequirementVersionsByControlName(
            @PathParam("domain")
            @jakarta.validation.constraints.Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName) {
        try {
            int controlId = resolveControlId(domain, controlName);
            return Response.ok(new ValueWrapper<>(controlStore.getRequirementVersions(domain, controlId))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving requirement versions for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return controlNotFoundResponse(controlName);
        }
    }

    @GET
    @Path("domains/{domain}/controls/{controlName}/requirement/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get requirement at a specific version by control name",
            description = "Returns the requirement JSON for the named control at the specified version"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getRequirementForVersionByControlName(
            @PathParam("domain")
            @jakarta.validation.constraints.Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("version")
            @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version) {
        try {
            int controlId = resolveControlId(domain, controlName);
            return Response.ok(controlStore.getRequirementForVersion(domain, controlId, version)).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving requirement for control [{}] version [{}]", domain, controlName, version, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return controlNotFoundResponse(controlName);
        } catch (ControlRequirementVersionNotFoundException e) {
            logger.error("Requirement version [{}] not found for control [{}]", version, controlName, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Requirement version not found: " + STRICT_SANITIZATION_POLICY.sanitize(version))
                    .build();
        }
    }

    @GET
    @Path("domains/{domain}/controls/{controlName}/configurations")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List configurations for a named control",
            description = "Returns the list of configurations (id + name) for the control with the given name"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getConfigurationsForControlByName(
            @PathParam("domain")
            @jakarta.validation.constraints.Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName) {
        try {
            int controlId = resolveControlId(domain, controlName);
            return Response.ok(new ValueWrapper<>(controlStore.getConfigurationDetailsForControl(domain, controlId))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving configurations for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return controlNotFoundResponse(controlName);
        }
    }

    @GET
    @Path("domains/{domain}/controls/{controlName}/configurations/{configName}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List versions for a named control's configuration",
            description = "Returns the list of versions for a specific configuration (identified by name) of the named control"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getConfigurationVersionsByControlName(
            @PathParam("domain")
            @jakarta.validation.constraints.Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("configName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String configName) {
        try {
            int controlId = resolveControlId(domain, controlName);
            int configId = resolveConfigId(domain, controlId, configName);
            return Response.ok(new ValueWrapper<>(controlStore.getConfigurationVersions(domain, controlId, configId))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving configuration versions for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return controlNotFoundResponse(controlName);
        } catch (ControlConfigurationNotFoundException e) {
            logger.error("Configuration [{}] not found for control [{}]", configName, controlName, e);
            return configNotFoundResponse(configName);
        }
    }

    @GET
    @Path("domains/{domain}/controls/{controlName}/configurations/{configName}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get a specific configuration version by control name and config name",
            description = "Returns the configuration JSON for the named control and named configuration at the specified version"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getConfigurationForVersionByControlName(
            @PathParam("domain")
            @jakarta.validation.constraints.Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("configName")
            @jakarta.validation.constraints.Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String configName,
            @PathParam("version")
            @jakarta.validation.constraints.Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version) {
        try {
            int controlId = resolveControlId(domain, controlName);
            int configId = resolveConfigId(domain, controlId, configName);
            return Response.ok(controlStore.getConfigurationForVersion(domain, controlId, configId, version)).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving configuration version for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return controlNotFoundResponse(controlName);
        } catch (ControlConfigurationNotFoundException e) {
            logger.error("Configuration [{}] not found for control [{}]", configName, controlName, e);
            return configNotFoundResponse(configName);
        } catch (ControlConfigurationVersionNotFoundException e) {
            logger.error("Configuration version [{}] not found for config [{}]", version, configName, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Configuration version not found: " + STRICT_SANITIZATION_POLICY.sanitize(version))
                    .build();
        }
    }

    // =========================================================================
    // Domain-control write helpers (shared by path-based POST and POST /calm)
    // =========================================================================

    /**
     * Handles a versioned control requirement POST, validating the {@code $id}, creating a new
     * control on first version (1.0.0) or adding a new requirement version to an existing one.
     */
    private Response handleControlRequirementPost(String domain, String controlName, String version,
                                                   String requestBody) throws URISyntaxException {
        if (requestBody == null || requestBody.isBlank()) {
            return invalidJsonResponse("Request body is required");
        }
        // Validate $id against canonical path URL
        String expectedId = documentParser.normalizeBase() + "/calm/domains/" + domain
                + "/controls/" + controlName + "/requirement/versions/" + version;
        String actualId;
        try {
            actualId = documentParser.extractIdFromJson(requestBody);
        } catch (Exception e) {
            return invalidJsonResponse("Cannot parse request body as JSON");
        }
        if (actualId == null || actualId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("$id is required").build();
        }
        if (!expectedId.equals(actualId)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("$id does not match the expected URL. Expected: " + expectedId).build();
        }

        String storedBody = documentParser.stripId(requestBody);
        // Extract description from body document (used when creating new control)
        String description = documentParser.extractStringField(requestBody, "description");

        try {
            // Check if control already exists
            int controlId;
            try {
                controlId = resolveControlId(domain, controlName);
            } catch (ControlNotFoundException notFound) {
                // New control: first version must be 1.0.0
                if (!"1.0.0".equals(version)) {
                    return Response.status(Response.Status.BAD_REQUEST)
                            .entity("The first version of a resource must be 1.0.0").build();
                }
                CreateControlRequirement req = new CreateControlRequirement(controlName, description, storedBody);
                controlStore.createControlRequirement(req, domain);
                URI location = new URI("/calm/domains/" + domain + "/controls/" + controlName
                        + "/requirement/versions/" + version);
                return Response.created(location).build();
            }
            // Existing control: add new requirement version
            CreateControlRequirement req = new CreateControlRequirement(controlName, description, storedBody);
            try {
                controlStore.createRequirementForVersion(domain, controlId, version, req);
            } catch (org.finos.calm.domain.exception.ControlRequirementVersionExistsException e) {
                return Response.status(Response.Status.CONFLICT)
                        .entity("Version " + STRICT_SANITIZATION_POLICY.sanitize(version) + " already exists").build();
            }
            URI location = new URI("/calm/domains/" + domain + "/controls/" + controlName
                    + "/requirement/versions/" + version);
            return Response.created(location).build();

        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when creating requirement for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}] when adding requirement version", controlName, domain, e);
            return controlNotFoundResponse(controlName);
        }
    }

    /**
     * Handles a versioned control configuration POST, validating the {@code $id}, creating a new
     * configuration on first version (1.0.0) or adding a new version to an existing configuration.
     */
    private Response handleControlConfigurationPost(String domain, String controlName, String configName,
                                                     String version, String requestBody) throws URISyntaxException {
        if (requestBody == null || requestBody.isBlank()) {
            return invalidJsonResponse("Request body is required");
        }
        // Validate $id against canonical path URL
        String expectedId = documentParser.normalizeBase() + "/calm/domains/" + domain
                + "/controls/" + controlName + "/configurations/" + configName + "/versions/" + version;
        String actualId;
        try {
            actualId = documentParser.extractIdFromJson(requestBody);
        } catch (Exception e) {
            return invalidJsonResponse("Cannot parse request body as JSON");
        }
        if (actualId == null || actualId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("$id is required").build();
        }
        if (!expectedId.equals(actualId)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("$id does not match the expected URL. Expected: " + expectedId).build();
        }

        String storedBody = documentParser.stripId(requestBody);

        try {
            int controlId = resolveControlId(domain, controlName);

            // Check if configuration with this name already exists
            int configId;
            try {
                configId = resolveConfigId(domain, controlId, configName);
            } catch (ControlConfigurationNotFoundException notFound) {
                // New configuration: first version must be 1.0.0
                if (!"1.0.0".equals(version)) {
                    return Response.status(Response.Status.BAD_REQUEST)
                            .entity("The first version of a resource must be 1.0.0").build();
                }
                CreateControlConfiguration req = new CreateControlConfiguration(configName, storedBody);
                controlStore.createControlConfiguration(req, domain, controlId);
                URI location = new URI("/calm/domains/" + domain + "/controls/" + controlName
                        + "/configurations/" + configName + "/versions/" + version);
                return Response.created(location).build();
            }
            // Existing configuration: add new version
            CreateControlConfiguration req = new CreateControlConfiguration(configName, storedBody);
            try {
                controlStore.createConfigurationForVersion(domain, controlId, configId, version, req);
            } catch (org.finos.calm.domain.exception.ControlConfigurationVersionExistsException e) {
                return Response.status(Response.Status.CONFLICT)
                        .entity("Version " + STRICT_SANITIZATION_POLICY.sanitize(version) + " already exists").build();
            } catch (ControlConfigurationNotFoundException e) {
                return configNotFoundResponse(configName);
            }
            URI location = new URI("/calm/domains/" + domain + "/controls/" + controlName
                    + "/configurations/" + configName + "/versions/" + version);
            return Response.created(location).build();

        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when creating configuration for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}] when adding configuration", controlName, domain, e);
            return controlNotFoundResponse(controlName);
        }
    }

    /**
     * Resolves a control name to its numeric ID within a domain.
     * Uses case-insensitive name matching.
     *
     * @param domain      the domain name
     * @param controlName the human-readable control name
     * @return the numeric controlId
     * @throws DomainNotFoundException   if the domain does not exist
     * @throws ControlNotFoundException  if no control with the given name exists in the domain
     */
    private int resolveControlId(String domain, String controlName) throws DomainNotFoundException, ControlNotFoundException {
        List<ControlDetail> controls = controlStore.getControlsForDomain(domain);
        return controls.stream()
                .filter(c -> controlName.equalsIgnoreCase(c.getName()))
                .findFirst()
                .map(ControlDetail::getId)
                .orElseThrow(ControlNotFoundException::new);
    }

    /**
     * Resolves a configuration name to its numeric ID within a control.
     * Uses case-insensitive name matching.
     *
     * @param domain      the domain name
     * @param controlId   the numeric control ID
     * @param configName  the human-readable configuration name
     * @return the numeric configurationId
     * @throws DomainNotFoundException              if the domain does not exist
     * @throws ControlConfigurationNotFoundException if no configuration with the given name exists
     */
    private int resolveConfigId(String domain, int controlId, String configName)
            throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        List<ControlConfigDetail> configs = controlStore.getConfigurationDetailsForControl(domain, controlId);
        return configs.stream()
                .filter(c -> configName.equalsIgnoreCase(c.getName()))
                .findFirst()
                .map(ControlConfigDetail::getId)
                .orElseThrow(ControlConfigurationNotFoundException::new);
    }

    private Response controlNotFoundResponse(String controlName) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Control not found: " + STRICT_SANITIZATION_POLICY.sanitize(controlName))
                .build();
    }

    private Response configNotFoundResponse(String configName) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Configuration not found: " + STRICT_SANITIZATION_POLICY.sanitize(configName))
                .build();
    }
}
