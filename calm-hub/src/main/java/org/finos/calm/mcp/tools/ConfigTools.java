package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.security.PermissionsAllowed;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.ResolvedConfigDefault;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.ConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * MCP tool provider for configs: versioned JSON that tools read to decide how to process or show CALM documents.
 * Read only. Configs are written over REST, where Hub checks each one against the schema of its type.
 */
@ApplicationScoped
@ReadOnlyHubGuard
public class ConfigTools {

    private static final Logger logger = LoggerFactory.getLogger(ConfigTools.class);
    private static final String CONFIG_TYPES = Arrays.stream(ConfigType.values())
            .map(ConfigType::getName)
            .collect(Collectors.joining(", "));

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    ConfigService configService;

    @Tool(description = "List the configs of one type in a CalmHub namespace. Config types: c4-mapping.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse listConfigs(
            @ToolArg(description = "The namespace to list configs from (e.g. 'finos')") String namespace,
            @ToolArg(description = "The config type (e.g. 'c4-mapping')") String configType) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConfigType(configType));
        if (err.isPresent()) return err.get();

        try {
            return McpResponseFormatter.formatResourceList(configType + " config", namespace,
                    configService.getConfigsForNamespace(namespace, ConfigType.fromName(configType).orElseThrow()).stream()
                            .map(s -> new McpResponseFormatter.ResourceSummary(s.getId(), s.getName(), s.getDescription()))
                            .toList());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    @Tool(description = "List the versions of a config in a CalmHub namespace.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse listConfigVersions(
            @ToolArg(description = "The namespace containing the config") String namespace,
            @ToolArg(description = "The config type (e.g. 'c4-mapping')") String configType,
            @ToolArg(description = "The config ID (positive integer)") int configId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConfigType(configType),
                () -> McpValidationHelper.validatePositiveId(configId, "Config ID"));
        if (err.isPresent()) return err.get();

        try {
            return McpResponseFormatter.formatVersionList("config", configId, namespace,
                    configService.getConfigVersions(namespace, ConfigType.fromName(configType).orElseThrow(), configId));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (ConfigNotFoundException e) {
            logger.warn("Config [{}] not found in namespace [{}]", configId, namespace, e);
            return McpResponseFormatter.entityNotFound("config", configId, namespace);
        }
    }

    @Tool(description = "Get the JSON of one version of a config.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse getConfig(
            @ToolArg(description = "The namespace containing the config") String namespace,
            @ToolArg(description = "The config type (e.g. 'c4-mapping')") String configType,
            @ToolArg(description = "The config ID (positive integer)") int configId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConfigType(configType),
                () -> McpValidationHelper.validatePositiveId(configId, "Config ID"),
                () -> McpValidationHelper.validateVersion(version));
        if (err.isPresent()) return err.get();

        try {
            return ToolResponse.success(configService.getConfigForVersion(namespace,
                    ConfigType.fromName(configType).orElseThrow(), configId, version));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (ConfigNotFoundException e) {
            logger.warn("Config [{}] not found in namespace [{}]", configId, namespace, e);
            return McpResponseFormatter.entityNotFound("config", configId, namespace);
        } catch (ConfigVersionNotFoundException e) {
            logger.warn("Version [{}] not found for config [{}]", version, configId, e);
            return McpResponseFormatter.versionNotFound("config", configId, version);
        }
    }

    @Tool(description = "Get the default config of one type that applies to a namespace: the default the namespace "
            + "sets, else that of its nearest ancestor (org.ab.cd, then org.ab, then org). Returns where the default "
            + "comes from and its JSON.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse getNamespaceDefaultConfig(
            @ToolArg(description = "The namespace to resolve the default for") String namespace,
            @ToolArg(description = "The config type (e.g. 'c4-mapping')") String configType) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConfigType(configType));
        if (err.isPresent()) return err.get();

        try {
            Optional<ResolvedConfigDefault> resolved =
                    configService.resolveDefault(namespace, ConfigType.fromName(configType).orElseThrow());
            if (resolved.isEmpty()) {
                return ToolResponse.success("No " + configType + " default applies to namespace '" + namespace
                        + "'. Tools use their built-in default.");
            }
            ResolvedConfigDefault value = resolved.get();
            return ToolResponse.success("The " + configType + " default for namespace '" + namespace + "' is config "
                    + value.configId() + " version " + value.version() + (value.inherited()
                    ? ", inherited from namespace '" + value.namespace() + "'"
                    : ", set on this namespace") + ".\n\n" + value.config());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    private static String validateConfigType(String configType) {
        return ConfigType.fromName(configType).isPresent()
                ? null
                : "Error: Unknown config type. Config types: " + CONFIG_TYPES + ".";
    }
}
