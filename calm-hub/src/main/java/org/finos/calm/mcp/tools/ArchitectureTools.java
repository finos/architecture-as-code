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
import java.util.Objects;
import java.util.Optional;

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
    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    boolean allowPutOperations;

    @Inject
    ArchitectureStore architectureStore;

    @Tool(description = "List all architectures in a CalmHub namespace. Returns architecture IDs, names, and descriptions.")
    public ToolResponse listArchitectures(
            @ToolArg(description = "The namespace to list architectures from (e.g. 'workshop', 'finos')") String namespace) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace));
        if (err.isPresent()) return err.get();

        try {
            List<NamespaceArchitectureSummary> architectures = architectureStore.getArchitecturesForNamespace(namespace);
            List<McpResponseFormatter.ResourceSummary> summaries = architectures.stream()
                    .map(a -> new McpResponseFormatter.ResourceSummary(a.getId(), a.getName(), a.getDescription()))
                    .toList();
            return McpResponseFormatter.formatResourceList("architecture", namespace, summaries);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    @Tool(description = "List available versions of an architecture in a CalmHub namespace.")
    public ToolResponse listArchitectureVersions(
            @ToolArg(description = "The namespace containing the architecture") String namespace,
            @ToolArg(description = "The architecture ID (positive integer)") int architectureId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(architectureId, "Architecture ID"));
        if (err.isPresent()) return err.get();

        try {
            Architecture arch = new Architecture.ArchitectureBuilder()
                    .setNamespace(namespace)
                    .setId(architectureId)
                    .build();
            List<String> versions = architectureStore.getArchitectureVersions(arch);
            return McpResponseFormatter.formatVersionList("architecture", architectureId, namespace, versions);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (ArchitectureNotFoundException e) {
            logger.warn("Architecture [{}] not found in namespace [{}]", architectureId, namespace, e);
            return McpResponseFormatter.entityNotFound("architecture", architectureId, namespace);
        }
    }

    @Tool(description = "Get the full JSON content of a specific architecture version. Use this to analyse architecture nodes, relationships, and controls.")
    public ToolResponse getArchitecture(
            @ToolArg(description = "The namespace containing the architecture") String namespace,
            @ToolArg(description = "The architecture ID (positive integer)") int architectureId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(architectureId, "Architecture ID"),
                () -> McpValidationHelper.validateVersion(version));
        if (err.isPresent()) return err.get();

        try {
            Architecture arch = new Architecture.ArchitectureBuilder()
                    .setNamespace(namespace)
                    .setId(architectureId)
                    .setVersion(version)
                    .build();
            return ToolResponse.success(architectureStore.getArchitectureForVersion(arch));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (ArchitectureNotFoundException e) {
            logger.warn("Architecture [{}] not found in namespace [{}]", architectureId, namespace, e);
            return McpResponseFormatter.entityNotFound("architecture", architectureId, namespace);
        } catch (ArchitectureVersionNotFoundException e) {
            logger.warn("Version [{}] not found for architecture [{}] in namespace [{}]", version, architectureId, namespace, e);
            return McpResponseFormatter.versionNotFound("architecture", architectureId, version);
        }
    }

    @Tool(description = "Publish a new version of an existing architecture. Use this to add a new semantic version (e.g. '1.1.0') against an existing architecture ID without allocating a new identity. Optionally supply name or description to overwrite them; omit (or pass null) to retain existing values.")
    public ToolResponse updateArchitecture(
            @ToolArg(description = "The namespace containing the architecture") String namespace,
            @ToolArg(description = "The architecture ID to publish a new version for (positive integer)") int architectureId,
            @ToolArg(description = "The new version string to publish (e.g. '1.1.0')") String version,
            @ToolArg(description = "The full CALM architecture JSON content for this version") String architectureJson,
            @ToolArg(description = "Optional new name for the architecture; omit to keep existing name", required = false) String name,
            @ToolArg(description = "Optional new description for the architecture; omit to keep existing description", required = false) String description) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.checkMutationAllowed(allowPutOperations),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(architectureId, "Architecture ID"),
                () -> McpValidationHelper.validateVersion(version),
                () -> McpValidationHelper.validateNotBlank(architectureJson, "Architecture JSON"),
                () -> McpValidationHelper.validateMaxLength(architectureJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Architecture JSON"),
                () -> McpValidationHelper.validateMaxLength(name, McpValidationHelper.MAX_NAME_LENGTH, "Architecture name"),
                () -> McpValidationHelper.validateDescriptionLength(description, "Architecture description"),
                () -> McpValidationHelper.validateJson(architectureJson, "Architecture JSON"));
        if (err.isPresent()) return err.get();

        String resolvedName = name;
        String resolvedDescription = description;
        if (resolvedName == null || resolvedDescription == null) {
            try {
                List<NamespaceArchitectureSummary> summaries = architectureStore.getArchitecturesForNamespace(namespace);
                for (NamespaceArchitectureSummary summary : summaries) {
                    if (Objects.equals(summary.getId(), architectureId)) {
                        if (resolvedName == null) resolvedName = summary.getName();
                        if (resolvedDescription == null) resolvedDescription = summary.getDescription();
                        break;
                    }
                }
            } catch (NamespaceNotFoundException e) {
                // will be surfaced below when updateArchitectureForVersion is called
            }
        }

        try {
            Architecture architecture = new Architecture.ArchitectureBuilder()
                    .setNamespace(namespace)
                    .setId(architectureId)
                    .setVersion(version)
                    .setName(resolvedName)
                    .setDescription(resolvedDescription)
                    .setArchitecture(architectureJson)
                    .build();
            architectureStore.updateArchitectureForVersion(architecture);
            logger.info("Architecture [{}] updated with version [{}] in namespace [{}]", architectureId, version, namespace);
            return ToolResponse.success("Architecture " + architectureId + " updated successfully with version '" + version + "' in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (ArchitectureNotFoundException e) {
            logger.warn("Architecture [{}] not found in namespace [{}]", architectureId, namespace, e);
            return McpResponseFormatter.entityNotFound("architecture", architectureId, namespace);
        }
    }

    @Tool(description = "Create a new architecture in a namespace. Returns the allocated architecture ID and version.")
    public ToolResponse createArchitecture(
            @ToolArg(description = "The namespace to create the architecture in") String namespace,
            @ToolArg(description = "The name of the architecture") String name,
            @ToolArg(description = "A description of the architecture") String description,
            @ToolArg(description = "The full CALM architecture JSON content") String architectureJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateMaxLength(name, McpValidationHelper.MAX_NAME_LENGTH, "Architecture name"),
                () -> McpValidationHelper.validateDescriptionLength(description, "Architecture description"),
                () -> McpValidationHelper.validateNotBlank(architectureJson, "Architecture JSON"),
                () -> McpValidationHelper.validateMaxLength(architectureJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Architecture JSON"),
                () -> McpValidationHelper.validateJson(architectureJson, "Architecture JSON"));
        if (err.isPresent()) return err.get();

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
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }
}
