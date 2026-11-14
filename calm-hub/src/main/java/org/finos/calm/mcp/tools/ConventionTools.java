package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.security.PermissionsAllowed;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.ResolvedConventionDefault;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.ConventionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * MCP tool provider for conventions: versioned JSON that tools read to decide how to process or show CALM documents.
 * Read only. Conventions are written over REST, where Hub checks each one against the schema of its type.
 */
@ApplicationScoped
@ReadOnlyHubGuard
public class ConventionTools {

    private static final Logger logger = LoggerFactory.getLogger(ConventionTools.class);
    private static final String CONVENTION_TYPES = Arrays.stream(ConventionType.values())
            .map(ConventionType::getName)
            .collect(Collectors.joining(", "));

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    ConventionService conventionService;

    @Tool(description = "List the conventions of one type in a CalmHub namespace. Convention types: c4-mapping.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse listConventions(
            @ToolArg(description = "The namespace to list conventions from (e.g. 'finos')") String namespace,
            @ToolArg(description = "The convention type (e.g. 'c4-mapping')") String conventionType) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConventionType(conventionType));
        if (err.isPresent()) return err.get();

        try {
            return McpResponseFormatter.formatResourceList(conventionType + " convention", namespace,
                    conventionService.getConventionsForNamespace(namespace, ConventionType.fromName(conventionType).orElseThrow()).stream()
                            .map(s -> new McpResponseFormatter.ResourceSummary(s.getId(), s.getName(), s.getDescription()))
                            .toList());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    @Tool(description = "List the versions of a convention in a CalmHub namespace.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse listConventionVersions(
            @ToolArg(description = "The namespace containing the convention") String namespace,
            @ToolArg(description = "The convention type (e.g. 'c4-mapping')") String conventionType,
            @ToolArg(description = "The convention ID (positive integer)") int conventionId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConventionType(conventionType),
                () -> McpValidationHelper.validatePositiveId(conventionId, "Convention ID"));
        if (err.isPresent()) return err.get();

        try {
            return McpResponseFormatter.formatVersionList("convention", conventionId, namespace,
                    conventionService.getConventionVersions(namespace, ConventionType.fromName(conventionType).orElseThrow(), conventionId));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (ConventionNotFoundException e) {
            logger.warn("Convention [{}] not found in namespace [{}]", conventionId, namespace, e);
            return McpResponseFormatter.entityNotFound("convention", conventionId, namespace);
        }
    }

    @Tool(description = "Get the JSON of one version of a convention.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse getConvention(
            @ToolArg(description = "The namespace containing the convention") String namespace,
            @ToolArg(description = "The convention type (e.g. 'c4-mapping')") String conventionType,
            @ToolArg(description = "The convention ID (positive integer)") int conventionId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConventionType(conventionType),
                () -> McpValidationHelper.validatePositiveId(conventionId, "Convention ID"),
                () -> McpValidationHelper.validateVersion(version));
        if (err.isPresent()) return err.get();

        try {
            return ToolResponse.success(conventionService.getConventionForVersion(namespace,
                    ConventionType.fromName(conventionType).orElseThrow(), conventionId, version));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (ConventionNotFoundException e) {
            logger.warn("Convention [{}] not found in namespace [{}]", conventionId, namespace, e);
            return McpResponseFormatter.entityNotFound("convention", conventionId, namespace);
        } catch (ConventionVersionNotFoundException e) {
            logger.warn("Version [{}] not found for convention [{}]", version, conventionId, e);
            return McpResponseFormatter.versionNotFound("convention", conventionId, version);
        }
    }

    @Tool(description = "Get the default convention of one type that applies to a namespace: the default the namespace "
            + "sets, else that of its nearest ancestor (org.ab.cd, then org.ab, then org). Returns where the default "
            + "comes from and its JSON.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse getNamespaceDefaultConvention(
            @ToolArg(description = "The namespace to resolve the default for") String namespace,
            @ToolArg(description = "The convention type (e.g. 'c4-mapping')") String conventionType) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConventionType(conventionType));
        if (err.isPresent()) return err.get();

        try {
            Optional<ResolvedConventionDefault> resolved =
                    conventionService.resolveDefault(namespace, ConventionType.fromName(conventionType).orElseThrow());
            if (resolved.isEmpty()) {
                return ToolResponse.success("No " + conventionType + " default applies to namespace '" + namespace
                        + "'. Tools use their built-in default.");
            }
            ResolvedConventionDefault value = resolved.get();
            return ToolResponse.success("The " + conventionType + " default for namespace '" + namespace + "' is convention "
                    + value.conventionId() + " version " + value.version() + (value.inherited()
                    ? ", inherited from namespace '" + value.namespace() + "'"
                    : ", set on this namespace") + ".\n\n" + value.convention());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    private static String validateConventionType(String conventionType) {
        return ConventionType.fromName(conventionType).isPresent()
                ? null
                : "Error: Unknown convention type. Convention types: " + CONVENTION_TYPES + ".";
    }
}
