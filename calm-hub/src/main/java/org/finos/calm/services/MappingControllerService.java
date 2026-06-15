package org.finos.calm.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.*;
import org.finos.calm.domain.controls.ControlConfigDetail;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.resources.CalmDocumentParser;
import org.finos.calm.resources.CalmResourceErrorResponses;
import org.finos.calm.store.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
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
    private final DomainStore domainStore;
    private final ControlStore controlStore;
    private final CalmDocumentParser documentParser;

    @Inject
    public MappingControllerService(ResourceMappingStore mappingStore,
                                    PatternStore patternStore,
                                    ArchitectureStore architectureStore,
                                    FlowStore flowStore,
                                    StandardStore standardStore,
                                    InterfaceStore interfaceStore,
                                    DomainStore domainStore,
                                    ControlStore controlStore,
                                    CalmDocumentParser documentParser) {
        this.mappingStore = mappingStore;
        this.patternStore = patternStore;
        this.architectureStore = architectureStore;
        this.flowStore = flowStore;
        this.standardStore = standardStore;
        this.interfaceStore = interfaceStore;
        this.domainStore = domainStore;
        this.controlStore = controlStore;
        this.documentParser = documentParser;
    }

    // =========================================================================
    // Namespace resource operations
    // =========================================================================

    /**
     * Looks up any existing mapping and either creates the resource fresh or appends a new
     * version, then handles any {@link NamespaceNotFoundException}.
     */
    public Response createOrAddVersion(String namespace, ResourceType resourceType, String type,
                                       String name, String requestBody,
                                       CalmDocumentParser.VersionSpec versionSpec)
            throws URISyntaxException {
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

    /**
     * Updates an existing version of a resource in place (PUT operation).
     */
    public Response updateVersionedResource(ResourceType resourceType, String namespace, String type,
                                            String name, int numericId, String version,
                                            String storedBody) throws URISyntaxException {
        try {
            updateVersionedResourceInStore(resourceType, namespace, numericId, version, storedBody);
            URI location = new URI("/calm/namespaces/" + namespace + "/" + type
                    + "/" + name + "/versions/" + version);
            return Response.created(location).build();
        } catch (NamespaceNotFoundException e) {
            logger.error("Invalid namespace [{}] when updating resource via PUT",
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (Exception e) {
            logger.error("Error updating resource [{}] in namespace [{}] via PUT",
                    STRICT_SANITIZATION_POLICY.sanitize(name),
                    STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
    }

    public ResourceMapping getMapping(String namespace, String name)
            throws MappingNotFoundException, NamespaceNotFoundException {
        return mappingStore.getMapping(namespace, name);
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
        };
    }

    public List<ResourceMapping> listMappings(String namespace, ResourceType resourceType)
            throws NamespaceNotFoundException {
        return mappingStore.listMappings(namespace, resourceType);
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
