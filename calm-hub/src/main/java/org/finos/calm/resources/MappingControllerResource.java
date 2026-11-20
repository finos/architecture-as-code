package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.*;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.exception.*;
import org.finos.calm.security.AuditRequestFilter;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.MappingControllerService;
import org.finos.calm.services.PatternImplementationService;
import org.finos.calm.domain.implementations.PatternImplementations;
import org.finos.calm.security.UserAccessValidator;
import jakarta.enterprise.inject.Instance;
import java.util.Optional;
import java.util.Set;
import org.finos.calm.store.util.SemanticVersionOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;

import static org.finos.calm.resources.ResourceValidationConstants.*;

/**
 * Name-based resource controller for the CALM Hub.
 *
 * <p>Exposes CALM resources (patterns, architectures, flows, standards, interfaces, timelines, ADRs) at
 * human-readable URLs under {@code /calm/namespaces/{namespace}/{type}/{name}}.  A mapping
 * from the friendly name to the underlying MongoDB numeric ID is maintained transparently.</p>
 *
 * <p>ADRs differ: the name is the ADR's slug, its versions are integer revisions the Hub
 * assigns, and the documents are {@code adr.json} (kebab-case). They have their own routes
 * with a literal {@code adrs} segment, which JAX-RS prefers over the generic {@code {type}}
 * routes. The {@code $id}-driven and semver write endpoints reject ADRs.</p>
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

    private final MappingControllerService service;
    private final CalmDocumentParser documentParser;
    private final CalmHubPermissionChecker permissionChecker;
    private final PatternImplementationService patternImplementationService;
    private final Instance<UserAccessValidator> userAccessValidatorInstance;

    @Inject
    SecurityIdentity identity;

    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    Boolean allowPutOperations;

    @Inject
    @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false")
    boolean authEnabled;

    @Inject
    public MappingControllerResource(MappingControllerService service,
                                     CalmDocumentParser documentParser,
                                     CalmHubPermissionChecker permissionChecker,
                                     PatternImplementationService patternImplementationService,
                                     Instance<UserAccessValidator> userAccessValidatorInstance) {
        this.service = service;
        this.documentParser = documentParser;
        this.permissionChecker = permissionChecker;
        this.patternImplementationService = patternImplementationService;
        this.userAccessValidatorInstance = userAccessValidatorInstance;
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
                    "A version is always required. For a brand-new resource the first version must be 1.0.0 or " +
                    "1.0.0-SNAPSHOT. " +
                    "For an existing resource the requested version is created (409 if it already exists). " +
                    "A version ending in -SNAPSHOT is mutable: posting to it again replaces its content and " +
                    "returns 200. Creating a snapshot whose release version is already published returns 409. " +
                    "Publishing a release version deletes the matching snapshot, if one exists."
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
                // Staged before the permission check below so AuditRequestFilter can record a
                // fully-identified DENIED entry even though the $id-driven entity isn't in the URL.
                AuditRequestFilter.stage(new AuditRequestFilter.AuditContext(
                        AuditEntityType.CONTROL_REQUIREMENT, AuditAction.CREATE, null, r.domain(), r.controlName(), r.version()));
                if (!permissionChecker.canWriteByDomain(identity, r.domain())) {
                    return Response.status(Response.Status.FORBIDDEN)
                            .entity("Insufficient permissions to write to domain: "
                                    + STRICT_SANITIZATION_POLICY.sanitize(r.domain())).build();
                }
                return service.handleControlRequirementPost(r.domain(), r.controlName(), r.version(), requestBody);
            } else if (domainId instanceof CalmDocumentParser.ControlConfigId c) {
                AuditRequestFilter.stage(new AuditRequestFilter.AuditContext(
                        AuditEntityType.CONTROL_CONFIGURATION, AuditAction.CREATE, null, c.domain(), c.configName(), c.version()));
                if (!permissionChecker.canWriteByDomain(identity, c.domain())) {
                    return Response.status(Response.Status.FORBIDDEN)
                            .entity("Insufficient permissions to write to domain: "
                                    + STRICT_SANITIZATION_POLICY.sanitize(c.domain())).build();
                }
                return service.handleControlConfigurationPost(c.domain(), c.controlName(), c.configName(), c.version(), requestBody);
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
        AuditRequestFilter.stage(new AuditRequestFilter.AuditContext(
                AuditEntityType.valueOf(canonical.resourceType().name()), AuditAction.CREATE,
                canonical.namespace(), null, canonical.name(), canonical.version()));
        if (!permissionChecker.canWrite(identity, canonical.namespace())) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Insufficient permissions to write to namespace: "
                            + STRICT_SANITIZATION_POLICY.sanitize(canonical.namespace())).build();
        }
        CalmDocumentParser.VersionSpec versionSpec = new CalmDocumentParser.VersionSpec(canonical.version(), true);
        return service.createOrAddVersion(canonical.namespace(), canonical.resourceType(),
                canonical.name(), requestBody, versionSpec);
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
        AuditRequestFilter.stage(new AuditRequestFilter.AuditContext(
                AuditEntityType.valueOf(canonical.resourceType().name()), AuditAction.UPDATE,
                canonical.namespace(), null, canonical.name(), canonical.version()));
        if (!permissionChecker.canWrite(identity, canonical.namespace())) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Insufficient permissions to write to namespace: "
                            + STRICT_SANITIZATION_POLICY.sanitize(canonical.namespace())).build();
        }
        if (canonical.resourceType() == ResourceType.STANDARD
                || canonical.resourceType() == ResourceType.INTERFACE) {
            return Response.status(Response.Status.NOT_IMPLEMENTED)
                    .entity("PUT is not supported for resource type: "
                            + CalmDocumentParser.TYPE_PLURAL_MAP.get(canonical.resourceType())).build();
        }
        ResourceMapping existing;
        try {
            existing = service.getMapping(canonical.namespace(), canonical.resourceType(), canonical.name());
        } catch (MappingNotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Resource not found: " + STRICT_SANITIZATION_POLICY.sanitize(canonical.name())).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when looking up resource for PUT",
                    STRICT_SANITIZATION_POLICY.sanitize(canonical.namespace()), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(canonical.namespace());
        }
        String storedBody = documentParser.stripId(requestBody);
        String title = documentParser.extractTitle(requestBody, canonical.resourceType());
        if (title.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(CalmDocumentParser.missingTitleMessage(canonical.resourceType())).build();
        }
        String description = documentParser.extractStringField(requestBody, "description");
        return service.updateVersionedResource(canonical.resourceType(), canonical.namespace(),
                canonical.name(), existing.getNumericId(), canonical.version(),
                title, description, storedBody);
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
                    "1.0.0 or 1.0.0-SNAPSHOT; for an existing resource the requested version is created (409 if it " +
                    "already exists). " +
                    "A version ending in -SNAPSHOT is mutable: posting to it again replaces its content and " +
                    "returns 200. Creating a snapshot whose release version is already published returns 409. " +
                    "Publishing a release version deletes the matching snapshot, if one exists."
    )
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createResourceVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("type") String type,
            @PathParam("name") @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String name,
            @PathParam("version") @Pattern(regexp = SNAPSHOT_VERSION_REGEX, message = SNAPSHOT_VERSION_MESSAGE) String version,
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
                            + ". Supported: " + CalmDocumentParser.SUPPORTED_TYPES).build();
        }
        if (resourceType == ResourceType.ADR) {
            return Response.status(Response.Status.BAD_REQUEST).entity(CalmDocumentParser.ADR_WRITE_MESSAGE).build();
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
            versionSpec = documentParser.resolveAndVerify(requestBody, namespace, resourceType, name, pathVersion);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
        } catch (JsonProcessingException e) {
            return invalidJsonResponse("Cannot parse request body as JSON");
        }

        return service.createOrAddVersion(namespace, resourceType, name, requestBody, versionSpec);
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
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("type") String type,
            @PathParam("name") @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String name
    ) {
        ResourceType resourceType = documentParser.parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)).build();
        }
        try {
            ResourceMapping mapping = service.getMapping(namespace, resourceType, name);
            List<String> versions = service.getVersionsForMapping(mapping);
            // VERSION_REGEX's optional separators make an all-digit string like "1234567"
            // valid semver *and* SHA-shaped. Only treat a version as a real git SHA - and so
            // skip semver sorting for the whole list - when it isn't also a valid semver on
            // its own terms; a genuine SHA containing a letter can never satisfy VERSION_REGEX.
            boolean hasShas = versions.stream()
                    .anyMatch(v -> v.matches("[0-9a-f]{7,40}") && !v.matches(VERSION_REGEX));
            List<String> sortedVersions;
            if (hasShas) {
                sortedVersions = versions;
            } else {
                // Semver::tryParse strips the -SNAPSHOT suffix, so a release and its snapshot tie.
                sortedVersions = versions.stream()
                        .sorted(SemanticVersionOrder.ASCENDING)
                        .toList();
            }
            return Response.ok(new ValueWrapper<>(sortedVersions)).build();
        } catch (MappingNotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Resource not found: " + STRICT_SANITIZATION_POLICY.sanitize(name)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when listing resource versions",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException | ArchitectureNotFoundException | FlowNotFoundException
                 | StandardNotFoundException | InterfaceNotFoundException | TimelineNotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Resource not found: " + STRICT_SANITIZATION_POLICY.sanitize(name)).build();
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
            description = "Returns the resource at the specified version (semver or git SHA). " +
                    "The \"$id\" in the returned document is rewritten to the versioned canonical URL."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getResourceVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("type") String type,
            @PathParam("name") @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String name,
            @PathParam("version") @Pattern(regexp = SNAPSHOT_VERSION_OR_SHA_REGEX, message = SNAPSHOT_VERSION_OR_SHA_MESSAGE) String version
    ) {
        ResourceType resourceType = documentParser.parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)).build();
        }
        try {
            ResourceMapping mapping = service.getMapping(namespace, resourceType, name);
            String json = service.getResourceJsonForVersion(mapping, version);
            String rewrittenJson = documentParser.rewriteId(json, namespace, resourceType, name, version);
            return Response.ok(rewrittenJson).build();
        } catch (MappingNotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Resource not found: " + STRICT_SANITIZATION_POLICY.sanitize(name)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when getting resource version",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (PatternNotFoundException | ArchitectureNotFoundException | FlowNotFoundException
                 | StandardNotFoundException | InterfaceNotFoundException | TimelineNotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Resource not found: " + STRICT_SANITIZATION_POLICY.sanitize(name)).build();
        } catch (PatternVersionNotFoundException | ArchitectureVersionNotFoundException
                 | FlowVersionNotFoundException | StandardVersionNotFoundException
                 | InterfaceVersionNotFoundException | TimelineVersionNotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Invalid version provided: " + version).build();
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
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("type") String type
    ) {
        ResourceType resourceType = documentParser.parseTypePlural(type);
        if (resourceType == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Unsupported resource type: " + STRICT_SANITIZATION_POLICY.sanitize(type)).build();
        }
        try {
            List<ResourceMapping> mappings = service.listMappings(namespace, resourceType);
            return Response.ok(new ValueWrapper<>(mappings)).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when listing named resources",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    // =========================================================================
    // ADRs — slug-addressed, integer revisions
    // =========================================================================

    // Explicit, though listNamedResources already serves it: a literal-segment template wins
    // the match, so with only a POST on it a GET here could resolve to 405, not the list.
    @GET
    @Path("namespaces/{namespace}/adrs")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List the ADRs in a namespace",
            description = "Returns the slug-to-numeric-ID mappings for every ADR in the namespace."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response listAdrs(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace
    ) {
        return listNamedResources(namespace, CalmDocumentParser.TYPE_PLURAL_MAP.get(ResourceType.ADR));
    }

    // The generic semver POST must refuse ADRs with a 400. Declared here for the same reason
    // as listAdrs: the literal-segment GET below would otherwise win the match and 405.
    @POST
    @Path("namespaces/{namespace}/adrs/{slug}/versions/{version}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Not supported for ADRs",
            description = "Always 400. Use POST /calm/namespaces/{namespace}/adrs/{slug} to add a revision."
    )
    @APIResponse(responseCode = "400", description = "ADR revisions are assigned by the Hub")
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createAdrVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("slug") String slug,
            @PathParam("version") String version,
            String requestBody
    ) {
        return Response.status(Response.Status.BAD_REQUEST).entity(CalmDocumentParser.ADR_WRITE_MESSAGE).build();
    }

    @POST
    @Path("namespaces/{namespace}/adrs")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Create an ADR",
            description = "The request body is an adr.json document. The ADR gets the document's slug if it has one "
                    + "(409 if another ADR holds it), else a slug derived from the title. A document with no status "
                    + "is created as draft. $id and unique-id are ignored. Returns the created document."
    )
    @APIResponse(responseCode = "201", description = "ADR created at revision 1")
    @APIResponse(responseCode = "400", description = "Invalid document, or chosen-option names no considered option")
    @APIResponse(responseCode = "404", description = "Namespace not found")
    @APIResponse(responseCode = "409", description = "The requested slug is taken")
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createAdr(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            String requestBody
    ) throws URISyntaxException {
        return service.createAdr(namespace, requestBody);
    }

    @POST
    @Path("namespaces/{namespace}/adrs/{slug}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Add a revision to an ADR",
            description = "The request body is an adr.json document, status included; it becomes the next revision "
                    + "as given. A slug in the body must equal the slug in the path. Returns the new revision."
    )
    @APIResponse(responseCode = "201", description = "Revision created")
    @APIResponse(responseCode = "400", description = "Invalid document")
    @APIResponse(responseCode = "404", description = "Namespace or ADR not found")
    @APIResponse(responseCode = "409", description = "A concurrent write created the same revision")
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createAdrRevision(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("slug") @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String slug,
            String requestBody
    ) throws URISyntaxException {
        return service.createAdrRevision(namespace, slug, requestBody);
    }

    @GET
    @Path("namespaces/{namespace}/adrs/{slug}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get the latest revision of an ADR",
            description = "Returns the ADR as an adr.json document whose $id is the canonical URL of the revision."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getAdr(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("slug") @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String slug
    ) {
        return service.getLatestAdr(namespace, slug);
    }

    @GET
    @Path("namespaces/{namespace}/adrs/{slug}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "List the revisions of an ADR",
            description = "Integer revisions as strings, ascending. GitHub-backed storage lists commit SHAs instead."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response listAdrVersions(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("slug") @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String slug
    ) {
        return service.listAdrVersions(namespace, slug);
    }

    @GET
    @Path("namespaces/{namespace}/adrs/{slug}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Get a revision of an ADR",
            description = "Returns the revision (an integer, or a commit SHA in GitHub-backed storage) as an "
                    + "adr.json document."
    )
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getAdrVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("slug") @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String slug,
            @PathParam("version") @Pattern(regexp = ADR_REVISION_OR_SHA_REGEX, message = ADR_REVISION_OR_SHA_MESSAGE) String version
    ) {
        return service.getAdrVersion(namespace, slug, version);
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
        return Response.ok(new ValueWrapper<>(service.getDomains())).build();
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
            service.createDomain(domainName);
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
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("version")
            @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version,
            String requestBody) throws URISyntaxException {
        return service.handleControlRequirementPost(domain, controlName, version, requestBody);
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
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("configName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String configName,
            @PathParam("version")
            @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version,
            String requestBody) throws URISyntaxException {
        return service.handleControlConfigurationPost(domain, controlName, configName, version, requestBody);
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
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain) {
        try {
            return Response.ok(new ValueWrapper<>(service.getControlsForDomain(domain))).build();
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
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName) {
        try {
            int controlId = service.resolveControlId(domain, controlName);
            return Response.ok(new ValueWrapper<>(service.getRequirementVersions(domain, controlId))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving requirement versions for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Control not found: " + STRICT_SANITIZATION_POLICY.sanitize(controlName)).build();
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
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("version")
            @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version) {
        try {
            int controlId = service.resolveControlId(domain, controlName);
            return Response.ok(service.getRequirementForVersion(domain, controlId, version)).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving requirement for control [{}] version [{}]", domain, controlName, version, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Control not found: " + STRICT_SANITIZATION_POLICY.sanitize(controlName)).build();
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
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName) {
        try {
            int controlId = service.resolveControlId(domain, controlName);
            return Response.ok(new ValueWrapper<>(service.getConfigurationsForControl(domain, controlId))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving configurations for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Control not found: " + STRICT_SANITIZATION_POLICY.sanitize(controlName)).build();
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
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("configName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String configName) {
        try {
            int controlId = service.resolveControlId(domain, controlName);
            int configId = service.resolveConfigId(domain, controlId, configName);
            return Response.ok(new ValueWrapper<>(service.getConfigurationVersions(domain, controlId, configId))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving configuration versions for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Control not found: " + STRICT_SANITIZATION_POLICY.sanitize(controlName)).build();
        } catch (ControlConfigurationNotFoundException e) {
            logger.error("Configuration [{}] not found for control [{}]", configName, controlName, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Configuration not found: " + STRICT_SANITIZATION_POLICY.sanitize(configName)).build();
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
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String controlName,
            @PathParam("configName")
            @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE)
            String configName,
            @PathParam("version")
            @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version) {
        try {
            int controlId = service.resolveControlId(domain, controlName);
            int configId = service.resolveConfigId(domain, controlId, configName);
            return Response.ok(service.getConfigurationForVersion(domain, controlId, configId, version)).build();
        } catch (DomainNotFoundException e) {
            logger.error("Domain [{}] not found when retrieving configuration version for control [{}]", domain, controlName, e);
            return CalmResourceErrorResponses.invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlName, domain, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Control not found: " + STRICT_SANITIZATION_POLICY.sanitize(controlName)).build();
        } catch (ControlConfigurationNotFoundException e) {
            logger.error("Configuration [{}] not found for control [{}]", configName, controlName, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Configuration not found: " + STRICT_SANITIZATION_POLICY.sanitize(configName)).build();
        } catch (ControlConfigurationVersionNotFoundException e) {
            logger.error("Configuration version [{}] not found for config [{}]", version, configName, e);
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Configuration version not found: " + STRICT_SANITIZATION_POLICY.sanitize(version))
                    .build();
        }
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private Response invalidJsonResponse(String message) {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity("Invalid JSON: " + message).build();
    }

    // =========================================================================
    // GET /calm/namespaces/{ns}/patterns/{name}/versions/{v}/implementations
    // =========================================================================

    @GET
    @Path("namespaces/{namespace}/patterns/{name}/versions/{version}/implementations")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Architectures implementing a pattern version",
            description = "Returns the architecture versions whose $schema names this pattern version, for assessing "
                    + "the blast radius of a pattern change. Matching reads the path of the $schema and never the "
                    + "host, so a reference survives the hub moving, and it is pinned to one pattern version. An "
                    + "architecture records its pattern only when it was generated from one fetched from this hub, "
                    + "so an empty list does not distinguish a pattern nothing implements from a set of "
                    + "architectures that record no pattern at all. Supports optional limit and offset; "
                    + "the default returns every match, because a truncated blast radius reads as a safe one."
    )
    @APIResponse(responseCode = "200", description = "Architecture versions naming this pattern version")
    @APIResponse(responseCode = "400", description = "Namespace, pattern name or version is malformed")
    @APIResponse(responseCode = "403", description = "The caller may not read the pattern's namespace")
    @APIResponse(responseCode = "404", description = "Pattern or version not found")
    @APIResponse(responseCode = "501", description = "Not available in GitHub storage mode")
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getPatternImplementations(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("name") @Pattern(regexp = CUSTOM_ID_REGEX, message = CUSTOM_ID_MESSAGE) String name,
            @PathParam("version") @Pattern(regexp = SNAPSHOT_VERSION_REGEX, message = SNAPSHOT_VERSION_MESSAGE) String version,
            @Valid @BeanParam PaginationQueryParams page
    ) {
        Optional<Set<String>> readableNamespaces = ReadableScope.resolve(
                authEnabled, userAccessValidatorInstance, identity, UserAccessValidator::getReadableNamespaces);

        return patternImplementationService
                .findImplementations(namespace, name, version, readableNamespaces, page.toPageRequest())
                .map(implementations -> Response.ok(implementations).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\":\"Pattern version not found\"}").build());
    }
}
