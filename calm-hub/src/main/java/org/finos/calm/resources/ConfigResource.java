package org.finos.calm.resources;

import io.quarkus.security.PermissionsAllowed;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.CreateConfigRequest;
import org.finos.calm.domain.configs.SetConfigDefaultRequest;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigSchemaValidationException;
import org.finos.calm.domain.exception.ConfigVersionExistsException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.ConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.util.Optional;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_OR_SHA_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_OR_SHA_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_REGEX;

/**
 * Versioned configs that tools read to decide how to process or show CALM documents, one set per config type, and
 * the default config that a namespace names for each type. See ADR 0019.
 */
@Tag(name = "Configs", description = "Versioned tool configs and namespace defaults")
@Path("/api/calm/namespaces")
public class ConfigResource {

    private static final Logger LOG = LoggerFactory.getLogger(ConfigResource.class);

    private final ConfigService configService;

    public ConfigResource(ConfigService configService) {
        this.configService = configService;
    }

    @GET
    @Path("{namespace}/configs/{configType}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List the configs of one type in a namespace")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Configs returned"),
            @APIResponse(responseCode = "400", description = "Unknown config type"),
            @APIResponse(responseCode = "404", description = "The namespace does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getConfigsForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("configType") String configType) {
        Optional<ConfigType> type = ConfigType.fromName(configType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConfigTypeResponse();
        }
        try {
            return Response.ok(new ValueWrapper<>(configService.getConfigsForNamespace(namespace, type.get()))).build();
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when listing configs", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @POST
    @Path("{namespace}/configs/{configType}")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Create a config", description = "Creates a config at immutable version 1.0.0. The config must match the schema of its type.")
    @APIResponses({
            @APIResponse(responseCode = "201", description = "Config created"),
            @APIResponse(responseCode = "400", description = "Unknown config type, or the config does not match the schema of its type"),
            @APIResponse(responseCode = "404", description = "The namespace does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createConfig(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("configType") String configType,
            CreateConfigRequest request) {
        Optional<ConfigType> type = ConfigType.fromName(configType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConfigTypeResponse();
        }
        try {
            int id = configService.createConfig(request, namespace, type.get());
            return Response.created(URI.create("/api/calm/namespaces/" + namespace + "/configs/"
                    + type.get().getName() + "/" + id + "/versions/1.0.0")).build();
        } catch (ConfigSchemaValidationException e) {
            return CalmResourceErrorResponses.configSchemaValidationResponse(e);
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when creating a config", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @GET
    @Path("{namespace}/configs/{configType}/{id}/versions")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List the versions of a config")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Versions returned"),
            @APIResponse(responseCode = "400", description = "Unknown config type"),
            @APIResponse(responseCode = "404", description = "The namespace or the config does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getConfigVersions(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("configType") String configType,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id) {
        Optional<ConfigType> type = ConfigType.fromName(configType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConfigTypeResponse();
        }
        try {
            return Response.ok(new ValueWrapper<>(configService.getConfigVersions(namespace, type.get(), id))).build();
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when listing config versions", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ConfigNotFoundException e) {
            LOG.error("Config [{}] not found when listing versions", id, e);
            return CalmResourceErrorResponses.configNotFoundResponse(namespace, id);
        }
    }

    @GET
    @Path("{namespace}/configs/{configType}/{id}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get a config version", description = "Returns the JSON of one immutable config version.")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Config JSON returned"),
            @APIResponse(responseCode = "400", description = "Unknown config type"),
            @APIResponse(responseCode = "404", description = "The namespace, the config or the version does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getConfigForVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("configType") String configType,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id,
            @PathParam("version") @Pattern(regexp = VERSION_OR_SHA_REGEX, message = VERSION_OR_SHA_MESSAGE) String version) {
        Optional<ConfigType> type = ConfigType.fromName(configType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConfigTypeResponse();
        }
        try {
            return Response.ok(configService.getConfigForVersion(namespace, type.get(), id, version)).build();
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when reading a config", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ConfigNotFoundException e) {
            LOG.error("Config [{}] not found", id, e);
            return CalmResourceErrorResponses.configNotFoundResponse(namespace, id);
        } catch (ConfigVersionNotFoundException e) {
            LOG.error("Version [{}] of config [{}] not found", STRICT_SANITIZATION_POLICY.sanitize(version), id, e);
            return CalmResourceErrorResponses.configVersionNotFoundResponse(id, version);
        }
    }

    @POST
    @Path("{namespace}/configs/{configType}/{id}/versions/{version}")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Create a config version", description = "Adds an immutable version to a config. The config must match the schema of its type.")
    @APIResponses({
            @APIResponse(responseCode = "201", description = "Config version created"),
            @APIResponse(responseCode = "400", description = "Unknown config type, or the config does not match the schema of its type"),
            @APIResponse(responseCode = "404", description = "The namespace or the config does not exist"),
            @APIResponse(responseCode = "409", description = "The version already exists")
    })
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public Response createConfigVersion(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("configType") String configType,
            @PathParam("id") @Min(value = 1, message = "ID must be a positive integer") int id,
            @PathParam("version") @Pattern(regexp = VERSION_REGEX, message = VERSION_MESSAGE) String version,
            CreateConfigRequest request) {
        Optional<ConfigType> type = ConfigType.fromName(configType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConfigTypeResponse();
        }
        try {
            configService.createConfigVersion(request, namespace, type.get(), id, version);
            return Response.created(URI.create("/api/calm/namespaces/" + namespace + "/configs/"
                    + type.get().getName() + "/" + id + "/versions/" + version)).build();
        } catch (ConfigSchemaValidationException e) {
            return CalmResourceErrorResponses.configSchemaValidationResponse(e);
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when creating a config version", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ConfigNotFoundException e) {
            LOG.error("Config [{}] not found when creating a version", id, e);
            return CalmResourceErrorResponses.configNotFoundResponse(namespace, id);
        } catch (ConfigVersionExistsException e) {
            LOG.error("Version [{}] of config [{}] already exists", STRICT_SANITIZATION_POLICY.sanitize(version), id, e);
            return Response.status(Response.Status.CONFLICT)
                    .entity("Config version already exists: " + STRICT_SANITIZATION_POLICY.sanitize(version)).build();
        }
    }

    @GET
    @Path("{namespace}/configs/{configType}/default")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get the default config that applies to a namespace",
            description = "Returns the default that the namespace sets, else that of its nearest ancestor (org.ab.cd, then org.ab, then org), with its JSON.")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Default returned. inherited is true when an ancestor sets it"),
            @APIResponse(responseCode = "400", description = "Unknown config type"),
            @APIResponse(responseCode = "404", description = "The namespace does not exist, or no namespace in its chain sets a default")
    })
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getDefault(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("configType") String configType) {
        Optional<ConfigType> type = ConfigType.fromName(configType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConfigTypeResponse();
        }
        try {
            return configService.resolveDefault(namespace, type.get())
                    .map(resolved -> Response.ok(resolved).build())
                    .orElseGet(() -> CalmResourceErrorResponses.noConfigDefaultResponse(namespace, type.get()));
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when resolving a config default", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }

    @PUT
    @Path("{namespace}/configs/{configType}/default")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Set the default config of a namespace",
            description = "Names a config version in this namespace as its default for the type. Child namespaces inherit it. Requires namespace admin.")
    @APIResponses({
            @APIResponse(responseCode = "200", description = "Default set"),
            @APIResponse(responseCode = "400", description = "Unknown config type, or no configId or version"),
            @APIResponse(responseCode = "404", description = "The namespace, the config or the version does not exist")
    })
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response setDefault(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("configType") String configType,
            SetConfigDefaultRequest request) {
        Optional<ConfigType> type = ConfigType.fromName(configType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConfigTypeResponse();
        }
        if (request == null || request.configId() == null || request.version() == null
                || !request.version().matches(VERSION_OR_SHA_REGEX)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("The body must have a configId and a version (semver or a hex SHA)").build();
        }
        try {
            return Response.ok(configService.setDefault(namespace, type.get(), request.configId(), request.version())).build();
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when setting a config default", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        } catch (ConfigNotFoundException e) {
            LOG.error("Config [{}] not found when setting a default", request.configId(), e);
            return CalmResourceErrorResponses.configNotFoundResponse(namespace, request.configId());
        } catch (ConfigVersionNotFoundException e) {
            LOG.error("Version of config [{}] not found when setting a default", request.configId(), e);
            return CalmResourceErrorResponses.configVersionNotFoundResponse(request.configId(), request.version());
        }
    }

    @DELETE
    @Path("{namespace}/configs/{configType}/default")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Remove the default config of a namespace",
            description = "The namespace then inherits the default of its nearest ancestor. Requires namespace admin.")
    @APIResponses({
            @APIResponse(responseCode = "204", description = "Default removed"),
            @APIResponse(responseCode = "400", description = "Unknown config type"),
            @APIResponse(responseCode = "404", description = "The namespace does not exist, or it sets no default")
    })
    @PermissionsAllowed(CalmHubScopes.ADMIN)
    public Response deleteDefault(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace,
            @PathParam("configType") String configType) {
        Optional<ConfigType> type = ConfigType.fromName(configType);
        if (type.isEmpty()) {
            return CalmResourceErrorResponses.unknownConfigTypeResponse();
        }
        try {
            return configService.deleteDefault(namespace, type.get())
                    ? Response.noContent().build()
                    : CalmResourceErrorResponses.noConfigDefaultResponse(namespace, type.get());
        } catch (NamespaceNotFoundException e) {
            LOG.error("Invalid namespace [{}] when removing a config default", STRICT_SANITIZATION_POLICY.sanitize(namespace), e);
            return CalmResourceErrorResponses.invalidNamespaceResponse(namespace);
        }
    }
}
