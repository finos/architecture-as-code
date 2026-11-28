package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.security.PermissionsAllowed;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.ResourceIdResolver;
import org.finos.calm.store.PatternStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/**
 * MCP tool provider for pattern resources. Exposes CRUD operations on
 * patterns within CalmHub namespaces via the Quarkiverse MCP server.
 */
@ApplicationScoped
@ReadOnlyHubGuard
public class PatternTools {

    private static final Logger logger = LoggerFactory.getLogger(PatternTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    boolean allowPutOperations;

    @Inject
    PatternStore patternStore;

    @Inject
    ResourceIdResolver resourceIdResolver;

    @Tool(description = "List all patterns in a CalmHub namespace. Returns pattern IDs, names, and descriptions.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse listPatterns(
            @ToolArg(description = "The namespace to list patterns from (e.g. 'workshop', 'finos')") String namespace) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace));
        if (err.isPresent()) return err.get();

        try {
            List<NamespaceResourceSummary> patterns = patternStore.getPatternsForNamespace(namespace);
            List<McpResponseFormatter.ResourceSummary> summaries = patterns.stream()
                    .map(p -> new McpResponseFormatter.ResourceSummary(p.getId(), p.getName(), p.getDescription()))
                    .toList();
            return McpResponseFormatter.formatResourceList("pattern", namespace, summaries);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    @Tool(description = "List available versions of a pattern in a CalmHub namespace.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse listPatternVersions(
            @ToolArg(description = "The namespace containing the pattern") String namespace,
            @ToolArg(description = "The pattern ID (numeric in MongoDB/standalone, filename stem in GitHub mode)") String patternId,
            @ToolArg(description = "Optional folder path for a GitHub id", required = false) String path,
            @ToolArg(description = "Optional variant for a GitHub id", required = false) String variant) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateResourceId(patternId, "Pattern ID"),
                () -> McpValidationHelper.validateOptionalPath(path),
                () -> McpValidationHelper.validateOptionalVariant(variant));
        if (err.isPresent()) return err.get();

        try {
            List<String> versions = patternStore.getPatternVersions(namespace,
                    resourceIdResolver.forStorage(patternId, path, variant));
            return McpResponseFormatter.formatVersionList("pattern", patternId, namespace, versions);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (PatternNotFoundException e) {
            logger.warn("Pattern [{}] not found in namespace [{}]", patternId, namespace, e);
            return McpResponseFormatter.entityNotFound("pattern", patternId, namespace);
        }
    }

    @Tool(description = "Get the full JSON content of a specific pattern version.")
    @PermissionsAllowed(CalmHubScopes.READ)
    public ToolResponse getPattern(
            @ToolArg(description = "The namespace containing the pattern") String namespace,
            @ToolArg(description = "The pattern ID (numeric in MongoDB/standalone, filename stem in GitHub mode)") String patternId,
            @ToolArg(description = "Optional folder path for a GitHub id", required = false) String path,
            @ToolArg(description = "Optional variant for a GitHub id", required = false) String variant,
            @ToolArg(description = "The version string, as returned by the list versions tool (e.g. '1.0.0', or a commit SHA in GitHub mode)") String version) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateResourceId(patternId, "Pattern ID"),
                () -> McpValidationHelper.validateOptionalPath(path),
                () -> McpValidationHelper.validateOptionalVariant(variant),
                () -> McpValidationHelper.validateSnapshotVersionOrSha(version));
        if (err.isPresent()) return err.get();

        try {
            return ToolResponse.success(patternStore.getPatternForVersion(namespace,
                    resourceIdResolver.forStorage(patternId, path, variant), version));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (PatternNotFoundException e) {
            logger.warn("Pattern [{}] not found in namespace [{}]", patternId, namespace, e);
            return McpResponseFormatter.entityNotFound("pattern", patternId, namespace);
        } catch (PatternVersionNotFoundException e) {
            logger.warn("Version [{}] not found for pattern [{}] in namespace [{}]", version, patternId, namespace, e);
            return McpResponseFormatter.versionNotFound("pattern", patternId, version);
        }
    }

    @Tool(description = "Create a new pattern in a namespace. Returns the allocated pattern ID and version.")
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public ToolResponse createPattern(
            @ToolArg(description = "The namespace to create the pattern in") String namespace,
            @ToolArg(description = "The name of the pattern") String name,
            @ToolArg(description = "A description of the pattern") String description,
            @ToolArg(description = "The full CALM pattern JSON content") String patternJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateNotBlank(name, "Pattern name"),
                () -> McpValidationHelper.validateMaxLength(name, McpValidationHelper.MAX_NAME_LENGTH, "Pattern name"),
                () -> McpValidationHelper.validateDescriptionLength(description, "Pattern description"),
                () -> McpValidationHelper.validateNotBlank(patternJson, "Pattern JSON"),
                () -> McpValidationHelper.validateMaxLength(patternJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Pattern JSON"),
                () -> McpValidationHelper.validateJson(patternJson, "Pattern JSON"));
        if (err.isPresent()) return err.get();

        try {
            CreatePatternRequest request = new CreatePatternRequest(name, description, patternJson);
            Pattern result = patternStore.createPatternForNamespace(request, namespace, "1.0.0");
            logger.info("Pattern created with ID [{}] in namespace [{}]", result.getId(), namespace);
            return ToolResponse.success("Pattern created successfully with ID: " + result.getId() + " (version " + result.getDotVersion() + ") in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    @Tool(description = "Publish a new version of an existing pattern. Use this to add a new semantic version (e.g. '1.1.0') against an existing pattern ID without allocating a new identity.")
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public ToolResponse createPatternVersion(
            @ToolArg(description = "The namespace containing the pattern") String namespace,
            @ToolArg(description = "The pattern ID (numeric in MongoDB/standalone, filename stem in GitHub mode)") String patternId,
            @ToolArg(description = "Optional folder path for a GitHub id", required = false) String path,
            @ToolArg(description = "Optional variant for a GitHub id", required = false) String variant,
            @ToolArg(description = "The new version string to publish (e.g. '1.1.0')") String version,
            @ToolArg(description = "The full CALM pattern JSON content for this version") String patternJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateResourceId(patternId, "Pattern ID"),
                () -> McpValidationHelper.validateOptionalPath(path),
                () -> McpValidationHelper.validateOptionalVariant(variant),
                () -> McpValidationHelper.validateVersion(version),
                () -> McpValidationHelper.validateNotBlank(patternJson, "Pattern JSON"),
                () -> McpValidationHelper.validateMaxLength(patternJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Pattern JSON"),
                () -> McpValidationHelper.validateJson(patternJson, "Pattern JSON"));
        if (err.isPresent()) return err.get();

        try {
            Pattern pattern = new Pattern.PatternBuilder()
                    .setNamespace(namespace)
                    .setId(resourceIdResolver.numericForWrite(resourceIdResolver.forStorage(patternId, path, variant)))
                    .setVersion(version)
                    .setPattern(patternJson)
                    .build();
            patternStore.createPatternForVersion(pattern);
            logger.info("Pattern [{}] version [{}] created in namespace [{}]", patternId, version, namespace);
            return ToolResponse.success("Pattern " + patternId + " version '" + version + "' created successfully in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (PatternNotFoundException e) {
            logger.warn("Pattern [{}] not found in namespace [{}]", patternId, namespace, e);
            return McpResponseFormatter.entityNotFound("pattern", patternId, namespace);
        } catch (PatternVersionExistsException e) {
            logger.warn("Version [{}] already exists for pattern [{}] in namespace [{}]", version, patternId, namespace, e);
            return ToolResponse.error("Error: Version '" + version + "' already exists for pattern " + patternId + ".");
        }
    }

    @Tool(description = "Update the content of an existing pattern version. Requires PUT operations to be enabled on this CalmHub instance.")
    @PermissionsAllowed(CalmHubScopes.WRITE)
    public ToolResponse updatePattern(
            @ToolArg(description = "The namespace containing the pattern") String namespace,
            @ToolArg(description = "The pattern ID (numeric in MongoDB/standalone, filename stem in GitHub mode)") String patternId,
            @ToolArg(description = "Optional folder path for a GitHub id", required = false) String path,
            @ToolArg(description = "Optional variant for a GitHub id", required = false) String variant,
            @ToolArg(description = "The version string to update (e.g. '1.0.0')") String version,
            @ToolArg(description = "The updated CALM pattern JSON content") String patternJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.checkMutationAllowed(allowPutOperations),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateResourceId(patternId, "Pattern ID"),
                () -> McpValidationHelper.validateOptionalPath(path),
                () -> McpValidationHelper.validateOptionalVariant(variant),
                () -> McpValidationHelper.validateVersion(version),
                () -> McpValidationHelper.validateNotBlank(patternJson, "Pattern JSON"),
                () -> McpValidationHelper.validateMaxLength(patternJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Pattern JSON"),
                () -> McpValidationHelper.validateJson(patternJson, "Pattern JSON"));
        if (err.isPresent()) return err.get();

        try {
            Pattern pattern = new Pattern.PatternBuilder()
                    .setNamespace(namespace)
                    .setId(resourceIdResolver.numericForWrite(resourceIdResolver.forStorage(patternId, path, variant)))
                    .setVersion(version)
                    .setPattern(patternJson)
                    .build();
            patternStore.updatePatternForVersion(pattern);
            logger.info("Pattern [{}] version [{}] updated in namespace [{}]", patternId, version, namespace);
            return ToolResponse.success("Pattern " + patternId + " version '" + version + "' updated successfully in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (PatternNotFoundException e) {
            logger.warn("Pattern [{}] not found in namespace [{}]", patternId, namespace, e);
            return McpResponseFormatter.entityNotFound("pattern", patternId, namespace);
        }
    }

    // Numeric-id overloads kept for callers that still have an int (not exposed as MCP tools).

    public ToolResponse listPatternVersions(String namespace, int patternId) {
        return listPatternVersions(namespace, String.valueOf(patternId), null, null);
    }

    public ToolResponse getPattern(String namespace, int patternId, String version) {
        return getPattern(namespace, String.valueOf(patternId), null, null, version);
    }

    public ToolResponse createPatternVersion(String namespace, int patternId, String version, String patternJson) {
        return createPatternVersion(namespace, String.valueOf(patternId), null, null, version, patternJson);
    }

    public ToolResponse updatePattern(String namespace, int patternId, String version, String patternJson) {
        return updatePattern(namespace, String.valueOf(patternId), null, null, version, patternJson);
    }
}
