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
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.*;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.store.ControlStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;

import static org.finos.calm.resources.ResourceValidationConstants.*;

/**
 * REST resource for managing controls within domains.
 */
@Tag(name = "Storage API", description = "Numeric-ID based CALM storage endpoints")
@Path("/api/calm/domains")
public class ControlResource {

    private final ControlStore store;

    private final Logger logger = LoggerFactory.getLogger(ControlResource.class);

    @Inject
    public ControlResource(ControlStore store) {
        this.store = store;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls")
    @Operation(
            summary = "Retrieve controls for a given domain",
            description = "Controls stored in a given domain"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getControlsForDomain(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain) {
        try {
            return Response.ok(new ValueWrapper<>(store.getControlsForDomain(domain))).build();
        } catch (DomainNotFoundException domainNotFoundException) {
            logger.error("Invalid domain [{}] when retrieving controls", domain, domainNotFoundException);
            return invalidDomainResponse(domain);
        }
    }

    @POST
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls")
    @Operation(
            summary = "Create a control requirement for a given domain",
            description = "Creates a new control requirement within the specified domain"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_WRITE)
    public Response createControlForDomain(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @Valid @NotNull(message = "Request must not be null") CreateControlRequirement createControlRequirement) {
        try {
            ControlDetail controlDetail = store.createControlRequirement(createControlRequirement, domain);
            return Response.created(URI.create("/api/calm/domains/" + domain + "/controls/" + controlDetail.getId())).entity(controlDetail).build();
        } catch (DomainNotFoundException domainNotFoundException) {
            logger.error("Invalid domain [{}] when creating control", domain, domainNotFoundException);
            return invalidDomainResponse(domain);
        }
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls/{controlId}/requirement/versions")
    @Operation(
            summary = "Retrieve requirement versions for a control",
            description = "Returns the list of versions for a control requirement"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getRequirementVersions(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlId") int controlId) {
        try {
            return Response.ok(new ValueWrapper<>(store.getRequirementVersions(domain, controlId))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Invalid domain [{}] when retrieving requirement versions", domain, e);
            return invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlId, domain, e);
            return invalidControlResponse(controlId);
        }
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls/{controlId}/requirement/versions/{version}")
    @Operation(
            summary = "Retrieve requirement at a specific version",
            description = "Returns the requirement JSON for a control at a given version"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getRequirementForVersion(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlId") int controlId,
            @PathParam("version")
            @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version) {
        try {
            return Response.ok(store.getRequirementForVersion(domain, controlId, version)).build();
        } catch (DomainNotFoundException e) {
            logger.error("Invalid domain [{}] when retrieving requirement version", domain, e);
            return invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlId, domain, e);
            return invalidControlResponse(controlId);
        } catch (ControlRequirementVersionNotFoundException e) {
            logger.error("Requirement version [{}] not found for control [{}]", version, controlId, e);
            return invalidVersionResponse(version);
        }
    }

    @POST
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls/{controlId}/requirement/versions/{version}")
    @Operation(
            summary = "Create a new requirement version for a control",
            description = "Creates a new version of the requirement for an existing control. The request body is an envelope containing the wrapper-level `name`, `description`, and inner `requirementJson` document; only the inner document is persisted as the version contents, and the wrapper-level name/description used by the control listing endpoint are taken directly from the envelope fields."
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_WRITE)
    public Response createRequirementForVersion(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlId") int controlId,
            @PathParam("version")
            @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version,
            @Valid @NotNull(message = "Request must not be null") CreateControlRequirement createControlRequirement) {
        try {
            store.createRequirementForVersion(domain, controlId, version, createControlRequirement);
            return Response.created(URI.create("/api/calm/domains/" + domain + "/controls/" + controlId + "/requirement/versions/" + version)).build();
        } catch (DomainNotFoundException e) {
            logger.error("Invalid domain [{}] when creating requirement version", domain, e);
            return invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlId, domain, e);
            return invalidControlResponse(controlId);
        } catch (ControlRequirementVersionExistsException e) {
            logger.error("Requirement version [{}] already exists for control [{}]", version, controlId, e);
            return Response.status(Response.Status.CONFLICT).entity("Version already exists: " + STRICT_SANITIZATION_POLICY.sanitize(version)).build();
        } catch (JsonParseException e) {
            logger.error("Cannot parse requirement JSON for control [{}] in domain [{}]", controlId, domain, e);
            return invalidJsonResponse();
        }
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls/{controlId}/configurations")
    @Operation(
            summary = "Retrieve configurations for a control",
            description = "Returns the list of configurations (id, name, title) for a given control"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getConfigurationsForControl(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlId") int controlId) {
        try {
            return Response.ok(new ValueWrapper<>(store.getConfigurationDetailsForControl(domain, controlId))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Invalid domain [{}] when retrieving configurations", domain, e);
            return invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlId, domain, e);
            return invalidControlResponse(controlId);
        }
    }

    @POST
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls/{controlId}/configurations")
    @Operation(
            summary = "Create a new configuration for a control",
            description = "Creates a new configuration within the specified control with an initial version 1.0.0"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_WRITE)
    public Response createControlConfiguration(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlId") int controlId,
            @Valid @NotNull(message = "Request must not be null") CreateControlConfiguration createControlConfiguration) {
        try {
            int configurationId = store.createControlConfiguration(createControlConfiguration, domain, controlId);
            return Response.created(URI.create("/api/calm/domains/" + domain + "/controls/" + controlId + "/configurations/" + configurationId)).build();
        } catch (DomainNotFoundException e) {
            logger.error("Invalid domain [{}] when creating configuration", domain, e);
            return invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlId, domain, e);
            return invalidControlResponse(controlId);
        }
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls/{controlId}/configurations/{configId}/versions")
    @Operation(
            summary = "Retrieve versions for a control configuration",
            description = "Returns the list of versions for a specific control configuration"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getConfigurationVersions(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlId") int controlId,
            @PathParam("configId") int configId) {
        try {
            return Response.ok(new ValueWrapper<>(store.getConfigurationVersions(domain, controlId, configId))).build();
        } catch (DomainNotFoundException e) {
            logger.error("Invalid domain [{}] when retrieving configuration versions", domain, e);
            return invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlId, domain, e);
            return invalidControlResponse(controlId);
        } catch (ControlConfigurationNotFoundException e) {
            logger.error("Configuration [{}] not found for control [{}]", configId, controlId, e);
            return invalidConfigurationResponse(configId);
        }
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls/{controlId}/configurations/{configId}/versions/{version}")
    @Operation(
            summary = "Retrieve a specific configuration version",
            description = "Returns the configuration JSON at a specific version"
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_READ)
    public Response getConfigurationForVersion(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlId") int controlId,
            @PathParam("configId") int configId,
            @PathParam("version")
            @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version) {
        try {
            return Response.ok(store.getConfigurationForVersion(domain, controlId, configId, version)).build();
        } catch (DomainNotFoundException e) {
            logger.error("Invalid domain [{}] when retrieving configuration version", domain, e);
            return invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlId, domain, e);
            return invalidControlResponse(controlId);
        } catch (ControlConfigurationNotFoundException e) {
            logger.error("Configuration [{}] not found for control [{}]", configId, controlId, e);
            return invalidConfigurationResponse(configId);
        } catch (ControlConfigurationVersionNotFoundException e) {
            logger.error("Configuration version [{}] not found for config [{}]", version, configId, e);
            return invalidVersionResponse(version);
        }
    }

    @POST
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Path("{domain}/controls/{controlId}/configurations/{configId}/versions/{version}")
    @Operation(
            summary = "Create a new version of a control configuration",
            description = "Creates a new version of the configuration for an existing control configuration. The request body is an envelope containing the inner `configurationJson` document; only the inner document is persisted as the version contents."
    )
    @PermissionsAllowed(CalmHubScopes.DOMAIN_WRITE)
    public Response createConfigurationForVersion(
            @PathParam("domain")
            @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE)
            String domain,
            @PathParam("controlId") int controlId,
            @PathParam("configId") int configId,
            @PathParam("version")
            @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE)
            String version,
            @Valid @NotNull(message = "Request must not be null") CreateControlConfiguration createControlConfiguration) {
        try {
            store.createConfigurationForVersion(domain, controlId, configId, version, createControlConfiguration);
            return Response.created(URI.create("/api/calm/domains/" + domain + "/controls/" + controlId + "/configurations/" + configId + "/versions/" + version)).build();
        } catch (DomainNotFoundException e) {
            logger.error("Invalid domain [{}] when creating configuration version", domain, e);
            return invalidDomainResponse(domain);
        } catch (ControlNotFoundException e) {
            logger.error("Control [{}] not found in domain [{}]", controlId, domain, e);
            return invalidControlResponse(controlId);
        } catch (ControlConfigurationNotFoundException e) {
            logger.error("Configuration [{}] not found for control [{}]", configId, controlId, e);
            return invalidConfigurationResponse(configId);
        } catch (ControlConfigurationVersionExistsException e) {
            logger.error("Configuration version [{}] already exists for config [{}]", version, configId, e);
            return Response.status(Response.Status.CONFLICT).entity("Version already exists: " + STRICT_SANITIZATION_POLICY.sanitize(version)).build();
        } catch (JsonParseException e) {
            logger.error("Cannot parse configuration JSON for config [{}] in control [{}]", configId, controlId, e);
            return invalidJsonResponse();
        }
    }

    private Response invalidDomainResponse(String domain) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Invalid domain provided: " + STRICT_SANITIZATION_POLICY.sanitize(domain))
                .build();
    }

    private Response invalidControlResponse(int controlId) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Control not found: " + controlId)
                .build();
    }

    private Response invalidConfigurationResponse(int configId) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Configuration not found: " + configId)
                .build();
    }

    private Response invalidVersionResponse(String version) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity("Version not found: " + STRICT_SANITIZATION_POLICY.sanitize(version))
                .build();
    }

    private Response invalidJsonResponse() {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity("The provided JSON could not be parsed")
                .build();
    }
}
