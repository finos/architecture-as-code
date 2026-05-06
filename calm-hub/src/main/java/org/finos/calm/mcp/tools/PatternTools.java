package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.pattern.NamespacePatternSummary;
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
public class PatternTools {

    private static final Logger logger = LoggerFactory.getLogger(PatternTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "true")
    boolean mcpEnabled;

    @Inject
    PatternStore patternStore;

    @Tool(description = "List all patterns in a CalmHub namespace. Returns pattern IDs, names, and descriptions.")
    public ToolResponse listPatterns(
            @ToolArg(description = "The namespace to list patterns from (e.g. 'workshop', 'finos')") String namespace) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace));
        if (err.isPresent()) return err.get();

        try {
            List<NamespacePatternSummary> patterns = patternStore.getPatternsForNamespace(namespace);
            if (patterns.isEmpty()) {
                return ToolResponse.success("No patterns found in namespace '" + namespace + "'.");
            }
            StringBuilder sb = new StringBuilder().append("Patterns in '").append(namespace).append("':\n");
            for (NamespacePatternSummary p : patterns) {
                sb.append("- ID: ").append(p.getId());
                if (p.getName() != null) {
                    sb.append(", Name: ").append(p.getName());
                }
                if (p.getDescription() != null) {
                    sb.append(", Description: ").append(p.getDescription());
                }
                sb.append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }

    @Tool(description = "List available versions of a pattern in a CalmHub namespace.")
    public ToolResponse listPatternVersions(
            @ToolArg(description = "The namespace containing the pattern") String namespace,
            @ToolArg(description = "The pattern ID (positive integer)") int patternId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(patternId, "Pattern ID"));
        if (err.isPresent()) return err.get();

        try {
            Pattern pattern = new Pattern.PatternBuilder()
                    .setNamespace(namespace)
                    .setId(patternId)
                    .build();
            List<String> versions = patternStore.getPatternVersions(pattern);
            if (versions.isEmpty()) {
                return ToolResponse.success("No versions found for pattern " + patternId + " in namespace '" + namespace + "'.");
            }
            StringBuilder sb = new StringBuilder().append("Versions for pattern ").append(patternId).append(":\n");
            for (String version : versions) {
                sb.append("- ").append(version).append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (PatternNotFoundException e) {
            logger.warn("Pattern [{}] not found in namespace [{}]", patternId, namespace, e);
            return ToolResponse.error("Error: Pattern " + patternId + " not found in namespace '" + namespace + "'.");
        }
    }

    @Tool(description = "Get the full JSON content of a specific pattern version.")
    public ToolResponse getPattern(
            @ToolArg(description = "The namespace containing the pattern") String namespace,
            @ToolArg(description = "The pattern ID (positive integer)") int patternId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(patternId, "Pattern ID"),
                () -> McpValidationHelper.validateVersion(version));
        if (err.isPresent()) return err.get();

        try {
            Pattern pattern = new Pattern.PatternBuilder()
                    .setNamespace(namespace)
                    .setId(patternId)
                    .setVersion(version)
                    .build();
            return ToolResponse.success(patternStore.getPatternForVersion(pattern));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (PatternNotFoundException e) {
            logger.warn("Pattern [{}] not found in namespace [{}]", patternId, namespace, e);
            return ToolResponse.error("Error: Pattern " + patternId + " not found in namespace '" + namespace + "'.");
        } catch (PatternVersionNotFoundException e) {
            logger.warn("Version [{}] not found for pattern [{}] in namespace [{}]", version, patternId, namespace, e);
            return ToolResponse.error("Error: Version '" + version + "' not found for pattern " + patternId + ".");
        }
    }

    @Tool(description = "Create a new pattern in a namespace. Returns the allocated pattern ID and version.")
    public ToolResponse createPattern(
            @ToolArg(description = "The namespace to create the pattern in") String namespace,
            @ToolArg(description = "The name of the pattern") String name,
            @ToolArg(description = "A description of the pattern") String description,
            @ToolArg(description = "The full CALM pattern JSON content") String patternJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateMaxLength(name, 200, "Pattern name"),
                () -> McpValidationHelper.validateDescriptionLength(description, "Pattern description"),
                () -> McpValidationHelper.validateNotBlank(patternJson, "Pattern JSON"),
                () -> McpValidationHelper.validateJson(patternJson, "Pattern JSON"));
        if (err.isPresent()) return err.get();

        try {
            CreatePatternRequest request = new CreatePatternRequest(name, description, patternJson);
            Pattern result = patternStore.createPatternForNamespace(request, namespace);
            logger.info("Pattern created with ID [{}] in namespace [{}]", result.getId(), namespace);
            return ToolResponse.success("Pattern created successfully with ID: " + result.getId() + " (version " + result.getDotVersion() + ") in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }

    @Tool(description = "Publish a new version of an existing pattern. Use this to add a new semantic version (e.g. '1.1.0') against an existing pattern ID without allocating a new identity.")
    public ToolResponse createPatternVersion(
            @ToolArg(description = "The namespace containing the pattern") String namespace,
            @ToolArg(description = "The pattern ID to publish a new version for (positive integer)") int patternId,
            @ToolArg(description = "The new version string to publish (e.g. '1.1.0')") String version,
            @ToolArg(description = "The full CALM pattern JSON content for this version") String patternJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(patternId, "Pattern ID"),
                () -> McpValidationHelper.validateVersion(version),
                () -> McpValidationHelper.validateNotBlank(patternJson, "Pattern JSON"),
                () -> McpValidationHelper.validateJson(patternJson, "Pattern JSON"));
        if (err.isPresent()) return err.get();

        try {
            Pattern pattern = new Pattern.PatternBuilder()
                    .setNamespace(namespace)
                    .setId(patternId)
                    .setVersion(version)
                    .setPattern(patternJson)
                    .build();
            patternStore.createPatternForVersion(pattern);
            logger.info("Pattern [{}] version [{}] created in namespace [{}]", patternId, version, namespace);
            return ToolResponse.success("Pattern " + patternId + " version '" + version + "' created successfully in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (PatternNotFoundException e) {
            logger.warn("Pattern [{}] not found in namespace [{}]", patternId, namespace, e);
            return ToolResponse.error("Error: Pattern " + patternId + " not found in namespace '" + namespace + "'.");
        } catch (PatternVersionExistsException e) {
            logger.warn("Version [{}] already exists for pattern [{}] in namespace [{}]", version, patternId, namespace, e);
            return ToolResponse.error("Error: Version '" + version + "' already exists for pattern " + patternId + ".");
        }
    }

    @Tool(description = "Update the content of an existing pattern version.")
    public ToolResponse updatePattern(
            @ToolArg(description = "The namespace containing the pattern") String namespace,
            @ToolArg(description = "The pattern ID (positive integer)") int patternId,
            @ToolArg(description = "The version string to update (e.g. '1.0.0')") String version,
            @ToolArg(description = "The updated CALM pattern JSON content") String patternJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(patternId, "Pattern ID"),
                () -> McpValidationHelper.validateVersion(version),
                () -> McpValidationHelper.validateNotBlank(patternJson, "Pattern JSON"),
                () -> McpValidationHelper.validateJson(patternJson, "Pattern JSON"));
        if (err.isPresent()) return err.get();

        try {
            Pattern pattern = new Pattern.PatternBuilder()
                    .setNamespace(namespace)
                    .setId(patternId)
                    .setVersion(version)
                    .setPattern(patternJson)
                    .build();
            patternStore.updatePatternForVersion(pattern);
            logger.info("Pattern [{}] version [{}] updated in namespace [{}]", patternId, version, namespace);
            return ToolResponse.success("Pattern " + patternId + " version '" + version + "' updated successfully in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (PatternNotFoundException e) {
            logger.warn("Pattern [{}] not found in namespace [{}]", patternId, namespace, e);
            return ToolResponse.error("Error: Pattern " + patternId + " not found in namespace '" + namespace + "'.");
        }
    }
}
