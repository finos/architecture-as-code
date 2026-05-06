package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.standards.NamespaceStandardSummary;
import org.finos.calm.store.StandardStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/**
 * MCP tool provider for standard resources. Exposes CRUD operations on
 * standards within CalmHub namespaces via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class StandardTools {

    private static final Logger logger = LoggerFactory.getLogger(StandardTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "true")
    boolean mcpEnabled;

    @Inject
    StandardStore standardStore;

    @Tool(description = "List all standards in a CalmHub namespace. Returns standard IDs, names, and descriptions.")
    public ToolResponse listStandards(
            @ToolArg(description = "The namespace to list standards from (e.g. 'workshop', 'finos')") String namespace) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace));
        if (err.isPresent()) return err.get();

        try {
            List<NamespaceStandardSummary> standards = standardStore.getStandardsForNamespace(namespace);
            if (standards.isEmpty()) {
                return ToolResponse.success("No standards found in namespace '" + namespace + "'.");
            }
            StringBuilder sb = new StringBuilder().append("Standards in '").append(namespace).append("':\n");
            for (NamespaceStandardSummary s : standards) {
                sb.append("- ID: ").append(s.getId());
                if (s.getName() != null) {
                    sb.append(", Name: ").append(s.getName());
                }
                if (s.getDescription() != null) {
                    sb.append(", Description: ").append(s.getDescription());
                }
                sb.append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }

    @Tool(description = "List available versions of a standard in a CalmHub namespace.")
    public ToolResponse listStandardVersions(
            @ToolArg(description = "The namespace containing the standard") String namespace,
            @ToolArg(description = "The standard ID (positive integer)") int standardId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(standardId, "Standard ID"));
        if (err.isPresent()) return err.get();

        try {
            List<String> versions = standardStore.getStandardVersions(namespace, standardId);
            if (versions.isEmpty()) {
                return ToolResponse.success("No versions found for standard " + standardId + " in namespace '" + namespace + "'.");
            }
            StringBuilder sb = new StringBuilder().append("Versions for standard ").append(standardId).append(":\n");
            for (String version : versions) {
                sb.append("- ").append(version).append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (StandardNotFoundException e) {
            logger.warn("Standard [{}] not found in namespace [{}]", standardId, namespace, e);
            return ToolResponse.error("Error: Standard " + standardId + " not found in namespace '" + namespace + "'.");
        }
    }

    @Tool(description = "Get the full JSON content of a specific standard version.")
    public ToolResponse getStandard(
            @ToolArg(description = "The namespace containing the standard") String namespace,
            @ToolArg(description = "The standard ID (positive integer)") int standardId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(standardId, "Standard ID"),
                () -> McpValidationHelper.validateVersion(version));
        if (err.isPresent()) return err.get();

        try {
            return ToolResponse.success(standardStore.getStandardForVersion(namespace, standardId, version));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (StandardNotFoundException e) {
            logger.warn("Standard [{}] not found in namespace [{}]", standardId, namespace, e);
            return ToolResponse.error("Error: Standard " + standardId + " not found in namespace '" + namespace + "'.");
        } catch (StandardVersionNotFoundException e) {
            logger.warn("Version [{}] not found for standard [{}] in namespace [{}]", version, standardId, namespace, e);
            return ToolResponse.error("Error: Version '" + version + "' not found for standard " + standardId + ".");
        }
    }

    @Tool(description = "Create a new standard in a namespace. Returns the allocated standard ID and version.")
    public ToolResponse createStandard(
            @ToolArg(description = "The namespace to create the standard in") String namespace,
            @ToolArg(description = "The name of the standard") String name,
            @ToolArg(description = "A description of the standard") String description,
            @ToolArg(description = "The full CALM standard JSON content") String standardJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateMaxLength(name, 200, "Standard name"),
                () -> McpValidationHelper.validateDescriptionLength(description, "Standard description"),
                () -> McpValidationHelper.validateNotBlank(standardJson, "Standard JSON"),
                () -> McpValidationHelper.validateJson(standardJson, "Standard JSON"));
        if (err.isPresent()) return err.get();

        try {
            CreateStandardRequest request = new CreateStandardRequest(name, description, standardJson);
            Standard result = standardStore.createStandardForNamespace(request, namespace);
            logger.info("Standard created with ID [{}] in namespace [{}]", result.getId(), namespace);
            return ToolResponse.success("Standard created successfully with ID: " + result.getId() + " (version " + result.getVersion() + ") in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }

    @Tool(description = "Publish a new version of an existing standard. Use this to add a new semantic version (e.g. '1.1.0') without allocating a new identity.")
    public ToolResponse createStandardVersion(
            @ToolArg(description = "The namespace containing the standard") String namespace,
            @ToolArg(description = "The standard ID (positive integer)") int standardId,
            @ToolArg(description = "The new version string to publish (e.g. '1.1.0')") String version,
            @ToolArg(description = "The full CALM standard JSON content for this version") String standardJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(standardId, "Standard ID"),
                () -> McpValidationHelper.validateVersion(version),
                () -> McpValidationHelper.validateNotBlank(standardJson, "Standard JSON"),
                () -> McpValidationHelper.validateJson(standardJson, "Standard JSON"));
        if (err.isPresent()) return err.get();

        try {
            CreateStandardRequest request = new CreateStandardRequest(null, null, standardJson);
            standardStore.createStandardForVersion(request, namespace, standardId, version);
            logger.info("Standard [{}] version [{}] created in namespace [{}]", standardId, version, namespace);
            return ToolResponse.success("Standard " + standardId + " version '" + version + "' created successfully in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (StandardNotFoundException e) {
            logger.warn("Standard [{}] not found in namespace [{}]", standardId, namespace, e);
            return ToolResponse.error("Error: Standard " + standardId + " not found in namespace '" + namespace + "'.");
        } catch (StandardVersionExistsException e) {
            logger.warn("Version [{}] already exists for standard [{}] in namespace [{}]", version, standardId, namespace, e);
            return ToolResponse.error("Error: Version '" + version + "' already exists for standard " + standardId + ".");
        }
    }
}
