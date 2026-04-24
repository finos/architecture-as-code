package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.architecture.NamespaceArchitectureSummary;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * MCP tool provider for architecture resources. Exposes CRUD operations on
 * architectures within CalmHub namespaces via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class ArchitectureTools {

    private static final Logger logger = LoggerFactory.getLogger(ArchitectureTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "true")
    boolean mcpEnabled;

    @Inject
    ArchitectureStore architectureStore;

    @Tool(description = "List all architectures in a CalmHub namespace. Returns architecture IDs, names, and descriptions.")
    public ToolResponse listArchitectures(
            @ToolArg(description = "The namespace to list architectures from (e.g. 'workshop', 'finos')") String namespace) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) {
            return ToolResponse.error(error);
        }

        try {
            List<NamespaceArchitectureSummary> architectures = architectureStore.getArchitecturesForNamespace(namespace);
            if (architectures.isEmpty()) {
                return ToolResponse.success("No architectures found in namespace '" + namespace + "'.");
            }
            StringBuilder sb = new StringBuilder().append("Architectures in '").append(namespace).append("':\n");
            for (NamespaceArchitectureSummary arch : architectures) {
                sb.append("- ID: ").append(arch.getId());
                if (arch.getName() != null) {
                    sb.append(", Name: ").append(arch.getName());
                }
                if (arch.getDescription() != null) {
                    sb.append(", Description: ").append(arch.getDescription());
                }
                sb.append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }

    @Tool(description = "List available versions of an architecture in a CalmHub namespace.")
    public ToolResponse listArchitectureVersions(
            @ToolArg(description = "The namespace containing the architecture") String namespace,
            @ToolArg(description = "The architecture ID (positive integer)") int architectureId) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validatePositiveId(architectureId, "Architecture ID");
        if (error != null) {
            return ToolResponse.error(error);
        }

        try {
            Architecture arch = new Architecture.ArchitectureBuilder()
                    .setNamespace(namespace)
                    .setId(architectureId)
                    .build();
            List<String> versions = architectureStore.getArchitectureVersions(arch);
            if (versions.isEmpty()) {
                return ToolResponse.success("No versions found for architecture " + architectureId + " in namespace '" + namespace + "'.");
            }
            StringBuilder sb = new StringBuilder().append("Versions for architecture ").append(architectureId).append(":\n");
            for (String version : versions) {
                sb.append("- ").append(version).append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (ArchitectureNotFoundException e) {
            logger.warn("Architecture [{}] not found in namespace [{}]", architectureId, namespace, e);
            return ToolResponse.error("Error: Architecture " + architectureId + " not found in namespace '" + namespace + "'.");
        }
    }

    @Tool(description = "Get the full JSON content of a specific architecture version. Use this to analyse architecture nodes, relationships, and controls.")
    public ToolResponse getArchitecture(
            @ToolArg(description = "The namespace containing the architecture") String namespace,
            @ToolArg(description = "The architecture ID (positive integer)") int architectureId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validatePositiveId(architectureId, "Architecture ID");
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateVersion(version);
        if (error != null) {
            return ToolResponse.error(error);
        }

        try {
            Architecture arch = new Architecture.ArchitectureBuilder()
                    .setNamespace(namespace)
                    .setId(architectureId)
                    .setVersion(version)
                    .build();
            return ToolResponse.success(architectureStore.getArchitectureForVersion(arch));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (ArchitectureNotFoundException e) {
            logger.warn("Architecture [{}] not found in namespace [{}]", architectureId, namespace, e);
            return ToolResponse.error("Error: Architecture " + architectureId + " not found in namespace '" + namespace + "'.");
        } catch (ArchitectureVersionNotFoundException e) {
            logger.warn("Version [{}] not found for architecture [{}] in namespace [{}]", version, architectureId, namespace, e);
            return ToolResponse.error("Error: Version '" + version + "' not found for architecture " + architectureId + ".");
        }
    }

    @Tool(description = "Create a new architecture in a namespace. Returns the allocated architecture ID and version.")
    public ToolResponse createArchitecture(
            @ToolArg(description = "The namespace to create the architecture in") String namespace,
            @ToolArg(description = "The name of the architecture") String name,
            @ToolArg(description = "A description of the architecture") String description,
            @ToolArg(description = "The full CALM architecture JSON content") String architectureJson) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateNotBlank(architectureJson, "Architecture JSON");
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateJson(architectureJson, "Architecture JSON");
        if (error != null) {
            return ToolResponse.error(error);
        }

        try {
            Architecture architecture = new Architecture.ArchitectureBuilder()
                    .setNamespace(namespace)
                    .setName(name)
                    .setDescription(description)
                    .setArchitecture(architectureJson)
                    .build();
            Architecture result = architectureStore.createArchitectureForNamespace(architecture);
            logger.info("Architecture created with ID [{}] in namespace [{}]", result.getId(), namespace);
            return ToolResponse.success("Architecture created successfully with ID: " + result.getId() + " (version " + result.getDotVersion() + ") in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }
}
