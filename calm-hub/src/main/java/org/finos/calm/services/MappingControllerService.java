package org.finos.calm.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.*;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.controls.ControlConfigDetail;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.resources.CalmDocumentParser;
import org.finos.calm.resources.CalmResourceErrorResponses;
import org.finos.calm.security.AuditRequestFilter;
import org.finos.calm.store.*;
import org.finos.calm.store.util.AdrDocumentMapper;
import org.finos.calm.store.util.CanonicalVersion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;

/**
 * Service that implements all CALM Hub resource-management business logic for the name-based API.
 *
 * <p>The {@link org.finos.calm.resources.MappingControllerResource} handles HTTP wiring (path
 * parameters, authentication, permission checks) and delegates every store interaction to this
 * service.</p>
 */
@ApplicationScoped
public class MappingControllerService {

    private final Logger logger = LoggerFactory.getLogger(MappingControllerService.class);

    private final ResourceMappingStore mappingStore;
    private final PatternStore patternStore;
    private final ArchitectureStore architectureStore;
    private final FlowStore flowStore;
    private final StandardStore standardStore;
    private final InterfaceStore interfaceStore;
    private final TimelineStore timelineStore;
    private final DomainStore domainStore;
    private final ControlStore controlStore;
    private final AdrStore adrStore;
    private final CalmDocumentParser documentParser;
    private final AdrDocumentMapper adrDocumentMapper = new AdrDocumentMapper();

    @Inject
    public MappingControllerService(ResourceMappingStore mappingStore,
                                    PatternStore patternStore,
                                    ArchitectureStore architectureStore,
                                    FlowStore flowStore,
                                    StandardStore standardStore,
                                    InterfaceStore interfaceStore,
                                    TimelineStore timelineStore,
                                    DomainStore domainStore,
                                    ControlStore controlStore,
                                    AdrStore adrStore,
                                    CalmDocumentParser documentParser) {
        this.mappingStore = mappingStore;
        this.patternStore = patternStore;
        this.architectureStore = architectureStore;
        this.flowStore = flowStore;
        this.standardStore = standardStore;
        this.interfaceStore = interfaceStore;
        this.timelineStore = timelineStore;
        this.domainStore = domainStore;
        this.controlStore = controlStore;
        this.adrStore = adrStore;
        this.documentParser = documentParser;
    }

    // =========================================================================
    // Namespace resource operations
    // =========================================================================

    /**
     * Looks up any existing mapping and either creates the resource fresh or appends a new
     * version, then handles any {@link NamespaceNotFoundException}.
     */
    public Response createOrAddVersion(String namespace, ResourceType resourceType,
                                       String name, String requestBody,
                                       CalmDocumentParser.VersionSpec versionSpec)
            throws URISyntaxException {
        if (resourceType == ResourceType.ADR) {
            return Response.status(Response.Status.BAD_REQUEST).entity(CalmDocumentParser.ADR_WRITE_MESSAGE).build();
        }
        try {
            ResourceMapping existing;
            try {
                existing = mappingStore.getMapping(namespace, resourceType, name);
            } catch (MappingNotFoundException ignored) {
                existing = null;
            }
            if (existing == null) {
                return createNewResource(namespace, resourceType, name, requestBody, versionSpec);
            } else {
                return addNewVersion(namespace, name, existing, requestBody, versionSpec);
            }
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating/updating resource",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    /**
     * Updates an existing version of a resource in place (PUT operation).
     */
    public Response updateVersionedResource(ResourceType resourceType, String namespace,
                                            String name, int numericId, String version,
                                            String title, String description, String storedBody) throws URISyntaxException {
        try {
            updateVersionedResourceInStore(resourceType, namespace, numericId, version, storedBody, title, description);
            URI location = new URI(CalmDocumentParser.namedResourcePath(namespace, resourceType, name, version));
            return Response.created(location).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when updating resource via PUT",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (GitHubWriteNotSupportedException e) {
            // Rethrow rather than let the broad catch below swallow it into a bodyless
            // 500 - UnsupportedOperationExceptionMapper turns this into the intended 501.
            throw e;
        } catch (Exception e) {
            logger.error("Error updating resource [{}] in namespace [{}] via PUT",
                    STRICT_SANITIZATION_POLICY.sanitize(name),
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * An ADR's mapping comes from its header's slug, not from the mapping store: the slug is
     * the ADR's own, immutable identity, so a second copy could only drift from it.
     */
    public ResourceMapping getMapping(String namespace, ResourceType type, String name)
            throws MappingNotFoundException, NamespaceNotFoundException {
        if (type == ResourceType.ADR) {
            try {
                return adrMapping(namespace, name, adrStore.getAdrIdBySlug(namespace, name));
            } catch (AdrNotFoundException e) {
                throw new MappingNotFoundException();
            }
        }
        return mappingStore.getMapping(namespace, type, name);
    }

    public List<String> getVersionsForMapping(ResourceMapping mapping) throws Exception {
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
            case TIMELINE -> {
                Timeline timeline = new Timeline.TimelineBuilder()
                        .setNamespace(mapping.getNamespace())
                        .setId(mapping.getNumericId())
                        .build();
                yield timelineStore.getTimelineVersions(timeline);
            }
            case ADR -> adrStore.getAdrVersions(mapping.getNamespace(), mapping.getNumericId());
        };
    }

    public String getResourceJsonForVersion(ResourceMapping mapping, String version) throws Exception {
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
            case TIMELINE -> {
                Timeline timeline = new Timeline.TimelineBuilder()
                        .setNamespace(mapping.getNamespace())
                        .setId(mapping.getNumericId())
                        .setVersion(version)
                        .build();
                yield timelineStore.getTimelineForVersion(timeline);
            }
            case ADR -> adrDocumentMapper.toDocument(
                    adrStore.getAdrForVersion(mapping.getNamespace(), mapping.getNumericId(), version).getAdr(),
                    null, mapping.getCustomId());
        };
    }

    public List<ResourceMapping> listMappings(String namespace, ResourceType resourceType)
            throws NamespaceNotFoundException {
        if (resourceType == ResourceType.ADR) {
            return adrStore.getAdrSlugs(namespace).stream()
                    .map(slug -> adrMapping(namespace, slug.slug(), slug.adrId()))
                    .toList();
        }
        return mappingStore.listMappings(namespace, resourceType);
    }

    // =========================================================================
    // ADR operations (name-based, slug-addressed)
    // =========================================================================

    /** The latest revision of the ADR with {@code slug}, as an {@code adr.json} document. */
    public Response getLatestAdr(String namespace, String slug) {
        try {
            int adrId = adrStore.getAdrIdBySlug(namespace, slug);
            AdrMeta latest = adrStore.getAdr(adrMeta(namespace, adrId));
            return Response.ok(adrDocument(namespace, slug, adrStore.getVersionLabel(latest), latest.getAdr())).build();
        } catch (NamespaceNotFoundException e) {
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (AdrNotFoundException | AdrRevisionNotFoundException e) {
            return adrNotFoundResponse(slug);
        } catch (AdrParseException e) {
            return adrParseFailureResponse(namespace, slug, e);
        }
    }

    /**
     * The ADR's versions. Revision numbers sort numerically, so 10 follows 9; a store whose
     * versions are not numbers (commit SHAs) keeps its own order.
     */
    public Response listAdrVersions(String namespace, String slug) {
        try {
            List<String> versions = adrStore.getAdrVersions(namespace, adrStore.getAdrIdBySlug(namespace, slug));
            if (versions.stream().allMatch(version -> version.matches("[0-9]+"))) {
                versions = versions.stream().sorted(Comparator.comparingLong(Long::parseLong)).toList();
            }
            return Response.ok(new ValueWrapper<>(versions)).build();
        } catch (NamespaceNotFoundException e) {
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (AdrNotFoundException | AdrRevisionNotFoundException e) {
            return adrNotFoundResponse(slug);
        }
    }

    public Response getAdrVersion(String namespace, String slug, String version) {
        try {
            int adrId = adrStore.getAdrIdBySlug(namespace, slug);
            AdrMeta adrMeta = adrStore.getAdrForVersion(namespace, adrId, version);
            return Response.ok(adrDocument(namespace, slug, version, adrMeta.getAdr())).build();
        } catch (NamespaceNotFoundException e) {
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (AdrNotFoundException e) {
            return adrNotFoundResponse(slug);
        } catch (AdrRevisionNotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Revision not found: " + STRICT_SANITIZATION_POLICY.sanitize(version)).build();
        } catch (AdrParseException e) {
            return adrParseFailureResponse(namespace, slug, e);
        }
    }

    /**
     * Creates an ADR from an {@code adr.json} document. The slug is the document's
     * {@code slug} if it has one, else derived from the title. A document with no status is
     * created as {@code draft}.
     */
    public Response createAdr(String namespace, String requestBody) throws URISyntaxException {
        AdrDocumentMapper.ParsedAdrDocument document;
        try {
            document = adrDocumentMapper.fromDocument(requestBody);
        } catch (AdrDocumentMapper.InvalidAdrDocumentException e) {
            return invalidAdrResponse(e);
        }
        LocalDateTime now = LocalDateTime.now();
        Adr adr = new Adr.AdrBuilder(document.request())
                .setStatus(document.status() != null ? document.status() : Status.draft)
                .setCreationDateTime(now)
                .setUpdateDateTime(now)
                .build();
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setSlug(document.slug())
                .setRevision(1)
                .setAdr(adr)
                .build();
        try {
            AdrMeta created = adrStore.createAdrForNamespace(adrMeta);
            return adrWrittenResponse(created);
        } catch (NamespaceNotFoundException e) {
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (AdrSlugExistsException e) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("An ADR with slug " + STRICT_SANITIZATION_POLICY.sanitize(document.slug())
                            + " already exists in namespace " + STRICT_SANITIZATION_POLICY.sanitize(namespace))
                    .build();
        } catch (AdrParseException e) {
            return adrParseFailureResponse(namespace, document.slug(), e);
        }
    }

    /**
     * Adds a revision to the ADR with {@code slug}, with exactly the document's content,
     * status included.
     */
    public Response createAdrRevision(String namespace, String slug, String requestBody) throws URISyntaxException {
        AdrDocumentMapper.ParsedAdrDocument document;
        try {
            document = adrDocumentMapper.fromDocument(requestBody);
        } catch (AdrDocumentMapper.InvalidAdrDocumentException e) {
            return invalidAdrResponse(e);
        }
        if (document.slug() != null && !document.slug().equals(slug)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("The document slug " + STRICT_SANITIZATION_POLICY.sanitize(document.slug())
                            + " does not match the slug in the path " + STRICT_SANITIZATION_POLICY.sanitize(slug))
                    .build();
        }
        if (document.status() == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invalid ADR: status is required").build();
        }
        try {
            int adrId = adrStore.getAdrIdBySlug(namespace, slug);
            Adr adr = new Adr.AdrBuilder(document.request())
                    .setStatus(document.status())
                    .setUpdateDateTime(LocalDateTime.now())
                    .build();
            AdrMeta created = adrStore.createAdrRevision(new AdrMeta.AdrMetaBuilder(adrMeta(namespace, adrId))
                    .setAdr(adr)
                    .build());
            return adrWrittenResponse(new AdrMeta.AdrMetaBuilder(created).setSlug(slug).build());
        } catch (NamespaceNotFoundException e) {
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (AdrNotFoundException | AdrRevisionNotFoundException e) {
            return adrNotFoundResponse(slug);
        } catch (AdrRevisionExistsException e) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("ADR " + STRICT_SANITIZATION_POLICY.sanitize(slug)
                            + " was updated at the same time, please retry").build();
        } catch (AdrParseException e) {
            return adrParseFailureResponse(namespace, slug, e);
        }
    }

    private Response adrWrittenResponse(AdrMeta written) throws URISyntaxException {
        String version = String.valueOf(written.getRevision());
        // Body-derived entity: the slug is only known once the store has assigned it.
        AuditRequestFilter.stage(new AuditRequestFilter.AuditContext(AuditEntityType.ADR,
                written.getRevision() == 1 ? AuditAction.CREATE : AuditAction.UPDATE,
                written.getNamespace(), null, written.getSlug(), version));
        URI location = new URI("/calm/namespaces/" + written.getNamespace() + "/adrs/" + written.getSlug()
                + "/versions/" + version);
        return Response.created(location)
                .entity(adrDocument(written.getNamespace(), written.getSlug(), version, written.getAdr()))
                .build();
    }

    private String adrDocument(String namespace, String slug, String version, Adr adr) {
        String id = documentParser.normalizeBase() + "/calm/namespaces/" + namespace + "/adrs/" + slug
                + "/versions/" + version;
        return adrDocumentMapper.toDocument(adr, id, slug);
    }

    private static AdrMeta adrMeta(String namespace, int adrId) {
        return new AdrMeta.AdrMetaBuilder().setNamespace(namespace).setId(adrId).build();
    }

    private static ResourceMapping adrMapping(String namespace, String slug, int adrId) {
        return new ResourceMapping.ResourceMappingBuilder()
                .setNamespace(namespace)
                .setCustomId(slug)
                .setResourceType(ResourceType.ADR)
                .setNumericId(adrId)
                .build();
    }

    private static Response invalidAdrResponse(AdrDocumentMapper.InvalidAdrDocumentException e) {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity("Invalid ADR: " + STRICT_SANITIZATION_POLICY.sanitize(e.getMessage())).build();
    }

    private static Response adrNotFoundResponse(String slug) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("ADR not found: " + STRICT_SANITIZATION_POLICY.sanitize(slug)).build();
    }

    private Response adrParseFailureResponse(String namespace, String slug, Exception e) {
        logger.error("Could not read or write ADR [{}] in namespace [{}]",
                STRICT_SANITIZATION_POLICY.sanitize(slug), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity("Could not parse ADR JSON").build();
    }

    // =========================================================================
    // Domain operations
    // =========================================================================

    public List<String> getDomains() {
        return domainStore.getDomains();
    }

    public void createDomain(String domainName) throws DomainAlreadyExistsException {
        domainStore.createDomain(domainName);
    }

    // =========================================================================
    // Control operations
    // =========================================================================

    /**
     * Handles a versioned control requirement POST, creating a new control on first version
     * (1.0.0) or adding a new requirement version to an existing one.
     */
    public Response handleControlRequirementPost(String domain, String controlName, String version,
                                                  String requestBody) throws URISyntaxException {
        if (requestBody == null || requestBody.isBlank()) {
            return invalidJsonResponse("Request body is required");
        }
        // Validate $id against canonical path URL
        String expectedId = documentParser.normalizeBase() + "/calm/domains/" + domain
                + "/controls/" + controlName + "/requirement/versions/" + version;
        String actualId;
        try {
            actualId = documentParser.extractIdFromJsonStrict(requestBody);
        } catch (JsonProcessingException e) {
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
        String description = documentParser.extractStringField(requestBody, "description");

        try {
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
            } catch (ControlRequirementVersionExistsException e) {
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
     * Handles a versioned control configuration POST, creating a new configuration on first
     * version (1.0.0) or adding a new version to an existing configuration.
     */
    public Response handleControlConfigurationPost(String domain, String controlName, String configName,
                                                    String version, String requestBody) throws URISyntaxException {
        if (requestBody == null || requestBody.isBlank()) {
            return invalidJsonResponse("Request body is required");
        }
        // Validate $id against canonical path URL
        String expectedId = documentParser.normalizeBase() + "/calm/domains/" + domain
                + "/controls/" + controlName + "/configurations/" + configName + "/versions/" + version;
        String actualId;
        try {
            actualId = documentParser.extractIdFromJsonStrict(requestBody);
        } catch (JsonProcessingException e) {
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
            } catch (ControlConfigurationVersionExistsException e) {
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

    public List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException {
        return controlStore.getControlsForDomain(domain);
    }

    public List<String> getRequirementVersions(String domain, int controlId)
            throws DomainNotFoundException, ControlNotFoundException {
        return controlStore.getRequirementVersions(domain, controlId);
    }

    public String getRequirementForVersion(String domain, int controlId, String version)
            throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionNotFoundException {
        return controlStore.getRequirementForVersion(domain, controlId, version);
    }

    public List<ControlConfigDetail> getConfigurationsForControl(String domain, int controlId)
            throws DomainNotFoundException, ControlNotFoundException {
        return controlStore.getConfigurationDetailsForControl(domain, controlId);
    }

    public List<String> getConfigurationVersions(String domain, int controlId, int configId)
            throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        return controlStore.getConfigurationVersions(domain, controlId, configId);
    }

    public String getConfigurationForVersion(String domain, int controlId, int configId, String version)
            throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException,
                   ControlConfigurationVersionNotFoundException {
        return controlStore.getConfigurationForVersion(domain, controlId, configId, version);
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
    public int resolveControlId(String domain, String controlName)
            throws DomainNotFoundException, ControlNotFoundException {
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
     * @param domain     the domain name
     * @param controlId  the numeric control ID
     * @param configName the human-readable configuration name
     * @return the numeric configurationId
     * @throws DomainNotFoundException              if the domain does not exist
     * @throws ControlConfigurationNotFoundException if no configuration with the given name exists
     */
    public int resolveConfigId(String domain, int controlId, String configName)
            throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException {
        List<ControlConfigDetail> configs = controlStore.getConfigurationDetailsForControl(domain, controlId);
        return configs.stream()
                .filter(c -> configName.equalsIgnoreCase(c.getName()))
                .findFirst()
                .map(ControlConfigDetail::getId)
                .orElseThrow(ControlConfigurationNotFoundException::new);
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Creates a brand-new resource (no mapping exists yet).
     * <p>The first version of a resource must be {@code 1.0.0} or {@code 1.0.0-SNAPSHOT} — this
     * is the main flow that lets a resource be iterated before its first publish. The rule is
     * about the release version, so {@code 2.0.0-SNAPSHOT} is still rejected with
     * {@code 400 Bad Request}.</p>
     */
    private Response createNewResource(String namespace, ResourceType resourceType,
                                       String name, String json, CalmDocumentParser.VersionSpec versionSpec) throws URISyntaxException {
        String finalVersion = versionSpec.version() != null ? versionSpec.version() : "1.0.0";
        // The request's release spelling must be canonicalised before comparison — releaseVersion
        // alone leaves "100-SNAPSHOT" as "100", which would never equal "1.0.0".
        if (!"1.0.0".equals(CanonicalVersion.of(ResourceVersion.releaseVersion(finalVersion)))) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("The first version of a resource must be 1.0.0 or 1.0.0-SNAPSHOT, but "
                            + STRICT_SANITIZATION_POLICY.sanitize(finalVersion) + " was requested")
                    .build();
        }
        String title = documentParser.extractTitle(json, resourceType);
        if (title.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(CalmDocumentParser.missingTitleMessage(resourceType)).build();
        }
        String description = documentParser.extractStringField(json, "description");
        try {
            mappingStore.createMapping(namespace, name, resourceType, 0);
            try {
                int numericId = createResourceInStore(resourceType, namespace, json, title, description, finalVersion);
                mappingStore.updateMappingNumericId(namespace, resourceType, name, numericId);
            } catch (Exception e) {
                try {
                    mappingStore.deleteMapping(namespace, resourceType, name);
                } catch (Exception rollbackEx) {
                    logger.error("Failed to rollback mapping for [{}] in namespace [{}]",
                            STRICT_SANITIZATION_POLICY.sanitize(name),
                            STRICT_SANITIZATION_POLICY.sanitize(namespace), rollbackEx);
                }
                throw e;
            }
            // The store folds the requested spelling to canonical form, so a Location built from
            // finalVersion would not match the version GET .../versions lists.
            URI location = new URI(CalmDocumentParser.namedResourcePath(
                    namespace, resourceType, name, CanonicalVersion.of(finalVersion)));
            return Response.created(location).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when creating resource",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (DuplicateMappingException e) {
            return CalmResourceErrorResponses.resourceAlreadyExistsResponse(resourceType, name, namespace);
        } catch (GitHubWriteNotSupportedException e) {
            // Rethrow rather than let the broad catch below swallow it into a 400 -
            // UnsupportedOperationExceptionMapper turns this into the intended 501.
            throw e;
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
    private Response addNewVersion(String namespace, String name,
                                   ResourceMapping mapping, String json, CalmDocumentParser.VersionSpec versionSpec) throws URISyntaxException {
        try {
            List<String> versions = getVersionsForMapping(mapping);
            if (versions.isEmpty()) {
                return mappingNotFoundResponse(name);
            }
            String newVersion = versionSpec.version();
            boolean snapshot = ResourceVersion.isSnapshot(newVersion);

            // A snapshot that shadows a published release makes promotion ambiguous: publishing
            // that release would have to both create and delete the same logical version.
            // versions holds canonical spellings, so the raw request's release spelling must be
            // canonicalised before comparison — 100-SNAPSHOT's release version is "100", which
            // would never match a stored "1.0.0" otherwise.
            if (snapshot && versions.contains(CanonicalVersion.of(ResourceVersion.releaseVersion(newVersion)))) {
                return CalmResourceErrorResponses.versionAlreadyExistsResponse(
                        ResourceVersion.releaseVersion(newVersion), mapping.getResourceType(), name, namespace);
            }
            // Releases stay immutable. A snapshot is mutable by design, so a repeat POST
            // overwrites it — a client never has to know whether it already exists.
            // Canonicalised before comparing, as above.
            boolean overwriting = versions.contains(CanonicalVersion.of(newVersion));
            if (overwriting && !snapshot) {
                return CalmResourceErrorResponses.versionAlreadyExistsResponse(
                        newVersion, mapping.getResourceType(), name, namespace);
            }

            String title = documentParser.extractTitle(json, mapping.getResourceType());
            if (title.isBlank()) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(CalmDocumentParser.missingTitleMessage(mapping.getResourceType())).build();
            }
            String description = documentParser.extractStringField(json, "description");

            if (overwriting) {
                // The resource layer stages a provisional CREATE before it knows whether this
                // version already exists — only here, once `versions` has been fetched, is it
                // known that this write destroys an existing snapshot rather than creating one.
                AuditRequestFilter.restageAction(AuditAction.UPDATE);
                updateVersionedResourceInStore(mapping.getResourceType(), namespace,
                        mapping.getNumericId(), newVersion, documentParser.stripId(json), title, description);
                return Response.ok().build();
            }
            createVersionedResourceInStore(mapping.getResourceType(), namespace,
                    mapping.getNumericId(), newVersion, json, title, description);

            if (!snapshot) {
                deleteSnapshotForVersion(mapping, newVersion, versions);
            }

            // The store folds the requested spelling to canonical form, so a Location built from
            // newVersion would not match the version GET .../versions lists.
            URI location = new URI(CalmDocumentParser.namedResourcePath(
                    namespace, mapping.getResourceType(), name, CanonicalVersion.of(newVersion)));
            return Response.created(location).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when updating resource",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (GitHubWriteNotSupportedException e) {
            // Rethrow rather than let the broad catch below swallow it into a 400 -
            // UnsupportedOperationExceptionMapper turns this into the intended 501.
            throw e;
        } catch (Exception e) {
            logger.error("Error updating resource [{}] in namespace [{}]",
                    STRICT_SANITIZATION_POLICY.sanitize(name), STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            String errorMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Failed to update resource: " + STRICT_SANITIZATION_POLICY.sanitize(errorMsg)).build();
        }
    }

    /**
     * Creates a new resource in the type-specific store and returns the assigned numeric ID.
     * {@code version} is the resource's first version — {@code 1.0.0} or
     * {@code 1.0.0-SNAPSHOT} — already validated by {@link #createNewResource}.
     */
    private int createResourceInStore(ResourceType type, String namespace, String json,
                                       String resourceName, String description, String version) throws Exception {
        // The $id was already verified against the canonical URL; strip it before storage as it is
        // re-derived on read and MongoDB rejects a top-level $id field (write error code 55).
        json = documentParser.stripId(json);
        return switch (type) {
            case PATTERN -> {
                CreatePatternRequest req = new CreatePatternRequest(resourceName, description, json);
                Pattern created = patternStore.createPatternForNamespace(req, namespace, version);
                yield created.getId();
            }
            case ARCHITECTURE -> {
                Architecture arch = new Architecture.ArchitectureBuilder()
                        .setNamespace(namespace)
                        .setArchitecture(json)
                        .setVersion(version)
                        .setName(resourceName)
                        .setDescription(description)
                        .build();
                Architecture created = architectureStore.createArchitectureForNamespace(arch);
                yield created.getId();
            }
            case FLOW -> {
                CreateFlowRequest req = new CreateFlowRequest(resourceName, description, json);
                Flow created = flowStore.createFlowForNamespace(req, namespace, version);
                yield created.getId();
            }
            case STANDARD -> {
                CreateStandardRequest req = new CreateStandardRequest(resourceName, description, json);
                Standard created = standardStore.createStandardForNamespace(req, namespace, version);
                yield created.getId();
            }
            case INTERFACE -> {
                CreateInterfaceRequest req = new CreateInterfaceRequest(resourceName, description, json);
                CalmInterface created = interfaceStore.createInterfaceForNamespace(req, namespace, version);
                yield created.getId();
            }
            case TIMELINE -> {
                CreateTimelineRequest req = new CreateTimelineRequest(resourceName, description, json);
                Timeline created = timelineStore.createTimelineForNamespace(req, namespace, version);
                yield created.getId();
            }
            case ADR -> throw new UnsupportedOperationException(CalmDocumentParser.ADR_WRITE_MESSAGE);
        };
    }

    /**
     * Creates a new version of an existing resource in the type-specific store.
     */
    private void createVersionedResourceInStore(ResourceType type, String namespace, int numericId,
                                                 String version, String json, String title, String description) throws Exception {
        // Strip the verified $id before storage (re-derived on read; Mongo rejects a top-level $id).
        json = documentParser.stripId(json);
        switch (type) {
            case PATTERN -> {
                Pattern pattern = new Pattern.PatternBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setPattern(json)
                        .setName(title)
                        .setDescription(description)
                        .build();
                patternStore.createPatternForVersion(pattern);
            }
            case ARCHITECTURE -> {
                Architecture arch = new Architecture.ArchitectureBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setArchitecture(json)
                        .setName(title)
                        .setDescription(description)
                        .build();
                architectureStore.createArchitectureForVersion(arch);
            }
            case FLOW -> {
                Flow flow = new Flow.FlowBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setFlow(json)
                        .setName(title)
                        .setDescription(description)
                        .build();
                flowStore.createFlowForVersion(flow);
            }
            case STANDARD -> {
                CreateStandardRequest req = new CreateStandardRequest(title, description, json);
                standardStore.createStandardForVersion(req, namespace, numericId, version);
            }
            case INTERFACE -> {
                CreateInterfaceRequest req = new CreateInterfaceRequest(title, description, json);
                interfaceStore.createInterfaceForVersion(req, namespace, numericId, version);
            }
            case TIMELINE -> {
                Timeline timeline = new Timeline.TimelineBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setTimeline(json)
                        .setName(title)
                        .setDescription(description)
                        .build();
                timelineStore.createTimelineForVersion(timeline);
            }
            case ADR -> throw new UnsupportedOperationException(CalmDocumentParser.ADR_WRITE_MESSAGE);
        }
    }

    /**
     * Updates an existing version of a resource in the type-specific store.
     * Supported for every {@link ResourceType} but {@link ResourceType#ADR}.
     */
    private void updateVersionedResourceInStore(ResourceType type, String namespace, int numericId,
                                                String version, String json, String title, String description) throws Exception {
        switch (type) {
            case PATTERN -> {
                Pattern pattern = new Pattern.PatternBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setPattern(json)
                        .setName(title)
                        .setDescription(description)
                        .build();
                patternStore.updatePatternForVersion(pattern);
            }
            case ARCHITECTURE -> {
                Architecture arch = new Architecture.ArchitectureBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setArchitecture(json)
                        .setName(title)
                        .setDescription(description)
                        .build();
                architectureStore.updateArchitectureForVersion(arch);
            }
            case FLOW -> {
                Flow flow = new Flow.FlowBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setFlow(json)
                        .setName(title)
                        .setDescription(description)
                        .build();
                flowStore.updateFlowForVersion(flow);
            }
            case STANDARD -> {
                CreateStandardRequest req = new CreateStandardRequest(title, description, json);
                standardStore.updateStandardForVersion(req, namespace, numericId, version);
            }
            case INTERFACE -> {
                CreateInterfaceRequest req = new CreateInterfaceRequest(title, description, json);
                interfaceStore.updateInterfaceForVersion(req, namespace, numericId, version);
            }
            case TIMELINE -> {
                Timeline timeline = new Timeline.TimelineBuilder()
                        .setNamespace(namespace)
                        .setId(numericId)
                        .setVersion(version)
                        .setTimeline(json)
                        .setName(title)
                        .setDescription(description)
                        .build();
                timelineStore.updateTimelineForVersion(timeline);
            }
            case ADR -> throw new UnsupportedOperationException(CalmDocumentParser.ADR_WRITE_MESSAGE);
            default -> throw new UnsupportedOperationException("Update not supported for resource type: " + type);
        }
    }

    /**
     * Removes the snapshot belonging to a version that has just been published.
     *
     * <p>{@code versions} is the list already fetched at the top of {@code addNewVersion},
     * <em>before</em> this release was written — checking it first avoids a pointless store
     * round trip when the resource never had a snapshot, which is the common case.</p>
     *
     * <p>Deliberately after the release write, and deliberately not rolled back. The two are
     * separate store operations with no transaction across them, so one of them has to go
     * first. If this fails, the release is correct but an orphan snapshot stays beside it — a
     * state the creation rule otherwise forbids. No endpoint deletes a single version, so
     * recovery needs a database edit or a delete of the whole resource. If the order were
     * reversed, a failed release write would have already destroyed the user's work in
     * progress.</p>
     *
     * <p>A release published through the numeric {@code /api/calm/...} write endpoints also
     * leaves an orphan, because that path calls the store directly and never reaches here.</p>
     */
    private void deleteSnapshotForVersion(ResourceMapping mapping, String releaseVersion, List<String> versions) {
        // Canonicalised before comparing, as in the shadow check above this method's call site.
        String snapshotVersion = ResourceVersion.asSnapshot(CanonicalVersion.of(releaseVersion));
        if (!versions.contains(snapshotVersion)) {
            return;
        }
        // Deliberately does NOT stage a DELETE for this snapshot removal. AuditRequestFilter
        // supports exactly one recorded row per request (a single ThreadLocal, read once at the
        // end of the request) — staging here would overwrite, not add to, whatever was staged
        // for the release write itself. The release write is the durable event an auditor asks
        // about ("who published 1.0.0?"); the snapshot delete is cleanup of the same request. If
        // a second row is ever wanted, the filter needs to support more than one context per
        // request — do not re-add a stage() call here without that.
        try {
            deleteVersionForMapping(mapping, snapshotVersion);
        } catch (Exception e) {
            logger.error("Published version [{}] of [{}] in namespace [{}] but failed to delete its "
                            + "snapshot [{}] — the snapshot now shadows a published version and should "
                            + "be removed manually",
                    STRICT_SANITIZATION_POLICY.sanitize(releaseVersion),
                    STRICT_SANITIZATION_POLICY.sanitize(mapping.getCustomId()),
                    STRICT_SANITIZATION_POLICY.sanitize(mapping.getNamespace()),
                    STRICT_SANITIZATION_POLICY.sanitize(snapshotVersion), e);
        }
    }

    private void deleteVersionForMapping(ResourceMapping mapping, String version) throws Exception {
        String namespace = mapping.getNamespace();
        int id = mapping.getNumericId();
        switch (mapping.getResourceType()) {
            case PATTERN -> patternStore.deletePatternVersion(namespace, id, version);
            case ARCHITECTURE -> architectureStore.deleteArchitectureVersion(namespace, id, version);
            case FLOW -> flowStore.deleteFlowVersion(namespace, id, version);
            case STANDARD -> standardStore.deleteStandardVersion(namespace, id, version);
            case INTERFACE -> interfaceStore.deleteInterfaceVersion(namespace, id, version);
            case TIMELINE -> timelineStore.deleteTimelineVersion(namespace, id, version);
            case ADR -> throw new UnsupportedOperationException(CalmDocumentParser.ADR_WRITE_MESSAGE);
            default -> throw new UnsupportedOperationException(
                    "Delete not supported for resource type: " + mapping.getResourceType());
        }
    }

    private Response mappingNotFoundResponse(String name) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Resource not found: " + STRICT_SANITIZATION_POLICY.sanitize(name)).build();
    }

    private Response invalidJsonResponse(String message) {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity("Invalid JSON: " + message).build();
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
