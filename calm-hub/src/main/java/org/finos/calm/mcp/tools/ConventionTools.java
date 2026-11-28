package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.security.PermissionsAllowed;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.ResourceId;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.ResolvedConventionDefault;
import org.finos.calm.domain.exception.InvalidResourceIdException;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.ConventionService;
import org.finos.calm.services.ResourceIdResolver;
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

    @Inject
    ResourceIdResolver resourceIdResolver;

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
                            .map(s -> new McpResponseFormatter.ResourceSummary(s.getId(), s.getName(), s.getDescription(), s.getTags()))
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
            @ToolArg(description = "The convention ID (numeric in MongoDB/standalone, filename stem in GitHub mode)") String conventionId,
            @ToolArg(description = "Optional folder path for a GitHub id", required = false) String path,
            @ToolArg(description = "Optional variant for a GitHub id", required = false) String variant) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConventionType(conventionType),
                () -> McpValidationHelper.validateResourceId(conventionId, "Convention ID"),
                () -> McpValidationHelper.validateOptionalPath(path),
                () -> McpValidationHelper.validateOptionalVariant(variant));
        if (err.isPresent()) return err.get();

        try {
            return McpResponseFormatter.formatVersionList("convention", conventionId, namespace,
                    conventionService.getConventionVersions(namespace, ConventionType.fromName(conventionType).orElseThrow(), resolve(conventionId, path, variant)));
        } catch (InvalidResourceIdException e) {
            logger.warn("Invalid resource id: {}", e.getMessage());
            return ToolResponse.error("Error: " + e.getMessage());
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
            @ToolArg(description = "The convention ID (numeric in MongoDB/standalone, filename stem in GitHub mode)") String conventionId,
            @ToolArg(description = "Optional folder path for a GitHub id", required = false) String path,
            @ToolArg(description = "Optional variant for a GitHub id", required = false) String variant,
            @ToolArg(description = "The version string, as returned by the list versions tool (e.g. '1.0.0', or a commit SHA in GitHub mode)") String version) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> validateConventionType(conventionType),
                () -> McpValidationHelper.validateResourceId(conventionId, "Convention ID"),
                () -> McpValidationHelper.validateOptionalPath(path),
                () -> McpValidationHelper.validateOptionalVariant(variant),
                () -> McpValidationHelper.validateVersionOrSha(version));
        if (err.isPresent()) return err.get();

        try {
            return ToolResponse.success(conventionService.getConventionForVersion(namespace,
                    ConventionType.fromName(conventionType).orElseThrow(), resolve(conventionId, path, variant), version));
        } catch (InvalidResourceIdException e) {
            logger.warn("Invalid resource id: {}", e.getMessage());
            return ToolResponse.error("Error: " + e.getMessage());
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

    private ResourceId resolve(String id, String path, String variant) {
        return resourceIdResolver.forStorage(id, path == null ? "" : path, variant == null ? "" : variant);
    }

    private int numericId(String id, String path, String variant) {
        return resourceIdResolver.numericForWrite(resolve(id, path, variant));
    }

    // Numeric-id overloads kept for callers that still have an int (not exposed as MCP tools).

    public ToolResponse listConventionVersions(String namespace, String conventionType, int conventionId) {
        return listConventionVersions(namespace, conventionType, String.valueOf(conventionId), null, null);
    }

    public ToolResponse getConvention(String namespace, String conventionType, int conventionId, String version) {
        return getConvention(namespace, conventionType, String.valueOf(conventionId), null, null, version);
    }
}
