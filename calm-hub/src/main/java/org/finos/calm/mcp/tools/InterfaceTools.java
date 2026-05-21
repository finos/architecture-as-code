package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.store.InterfaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * MCP tool provider for interface resources. Exposes read and create operations on
 * interfaces within CalmHub namespaces via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class InterfaceTools {

    private static final Logger logger = LoggerFactory.getLogger(InterfaceTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "true")
    boolean mcpEnabled;

    @Inject
    InterfaceStore interfaceStore;

    @Tool(description = "List all interfaces in a CalmHub namespace. Returns interface IDs, names, and descriptions.")
    public ToolResponse listInterfaces(
            @ToolArg(description = "The namespace to list interfaces from (e.g. 'workshop', 'finos')") String namespace) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace));
        if (err.isPresent()) return err.get();

        try {
            List<NamespaceInterfaceSummary> interfaces = interfaceStore.getInterfacesForNamespace(namespace);
            List<McpResponseFormatter.ResourceSummary> summaries = interfaces.stream()
                    .map(i -> new McpResponseFormatter.ResourceSummary(i.getId(), i.getName(), i.getDescription()))
                    .toList();
            return McpResponseFormatter.formatResourceList("interface", namespace, summaries);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    @Tool(description = "List available versions of an interface in a CalmHub namespace.")
    public ToolResponse listInterfaceVersions(
            @ToolArg(description = "The namespace containing the interface") String namespace,
            @ToolArg(description = "The interface ID (positive integer)") int interfaceId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(interfaceId, "Interface ID"));
        if (err.isPresent()) return err.get();

        try {
            List<String> versions = interfaceStore.getInterfaceVersions(namespace, interfaceId);
            return McpResponseFormatter.formatVersionList("interface", interfaceId, namespace, versions);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (InterfaceNotFoundException e) {
            logger.warn("Interface [{}] not found in namespace [{}]", interfaceId, namespace, e);
            return McpResponseFormatter.entityNotFound("interface", interfaceId, namespace);
        }
    }

    @Tool(description = "Get the full JSON content of a specific interface version.")
    public ToolResponse getInterface(
            @ToolArg(description = "The namespace containing the interface") String namespace,
            @ToolArg(description = "The interface ID (positive integer)") int interfaceId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(interfaceId, "Interface ID"),
                () -> McpValidationHelper.validateVersion(version));
        if (err.isPresent()) return err.get();

        try {
            return ToolResponse.success(interfaceStore.getInterfaceForVersion(namespace, interfaceId, version));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (InterfaceNotFoundException e) {
            logger.warn("Interface [{}] not found in namespace [{}]", interfaceId, namespace, e);
            return McpResponseFormatter.entityNotFound("interface", interfaceId, namespace);
        } catch (InterfaceVersionNotFoundException e) {
            logger.warn("Version [{}] not found for interface [{}] in namespace [{}]", version, interfaceId, namespace, e);
            return McpResponseFormatter.versionNotFound("interface", interfaceId, version);
        }
    }

    @Tool(description = "Create a new interface in a namespace. Returns the allocated interface ID and version.")
    public ToolResponse createInterface(
            @ToolArg(description = "The namespace to create the interface in") String namespace,
            @ToolArg(description = "The name of the interface") String name,
            @ToolArg(description = "A description of the interface") String description,
            @ToolArg(description = "The full CALM interface JSON content") String interfaceJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateNotBlank(name, "Interface name"),
                () -> McpValidationHelper.validateMaxLength(name, McpValidationHelper.MAX_NAME_LENGTH, "Interface name"),
                () -> McpValidationHelper.validateDescriptionLength(description, "Interface description"),
                () -> McpValidationHelper.validateNotBlank(interfaceJson, "Interface JSON"),
                () -> McpValidationHelper.validateMaxLength(interfaceJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Interface JSON"),
                () -> McpValidationHelper.validateJson(interfaceJson, "Interface JSON"));
        if (err.isPresent()) return err.get();

        try {
            CreateInterfaceRequest request = new CreateInterfaceRequest(name, description, interfaceJson);
            CalmInterface result = interfaceStore.createInterfaceForNamespace(request, namespace);
            logger.info("Interface created with ID [{}] in namespace [{}]", result.getId(), namespace);
            return ToolResponse.success("Interface created successfully with ID: " + result.getId() + " (version " + result.getVersion() + ") in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    @Tool(description = "Publish a new version of an existing interface. Use this to add a new semantic version (e.g. '1.1.0') without allocating a new identity.")
    public ToolResponse createInterfaceVersion(
            @ToolArg(description = "The namespace containing the interface") String namespace,
            @ToolArg(description = "The interface ID (positive integer)") int interfaceId,
            @ToolArg(description = "The new version string to publish (e.g. '1.1.0')") String version,
            @ToolArg(description = "The full CALM interface JSON content for this version") String interfaceJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(interfaceId, "Interface ID"),
                () -> McpValidationHelper.validateVersion(version),
                () -> McpValidationHelper.validateNotBlank(interfaceJson, "Interface JSON"),
                () -> McpValidationHelper.validateMaxLength(interfaceJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Interface JSON"),
                () -> McpValidationHelper.validateJson(interfaceJson, "Interface JSON"));
        if (err.isPresent()) return err.get();

        try {
            List<NamespaceInterfaceSummary> interfaces = interfaceStore.getInterfacesForNamespace(namespace);
            String existingName = null;
            String existingDescription = null;
            boolean interfaceFound = false;
            for (NamespaceInterfaceSummary s : interfaces) {
                if (Objects.equals(s.getId(), interfaceId)) {
                    existingName = s.getName();
                    existingDescription = s.getDescription();
                    interfaceFound = true;
                    break;
                }
            }
            if (!interfaceFound) {
                logger.warn("Interface [{}] not found in namespace summary for [{}]", interfaceId, namespace);
                return McpResponseFormatter.entityNotFound("interface", interfaceId, namespace);
            }
            CreateInterfaceRequest request = new CreateInterfaceRequest(existingName, existingDescription, interfaceJson);
            interfaceStore.createInterfaceForVersion(request, namespace, interfaceId, version);
            logger.info("Interface [{}] version [{}] created in namespace [{}]", interfaceId, version, namespace);
            return ToolResponse.success("Interface " + interfaceId + " version '" + version + "' created successfully in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (InterfaceNotFoundException e) {
            logger.warn("Interface [{}] not found in namespace [{}]", interfaceId, namespace, e);
            return McpResponseFormatter.entityNotFound("interface", interfaceId, namespace);
        } catch (InterfaceVersionExistsException e) {
            logger.warn("Version [{}] already exists for interface [{}] in namespace [{}]", version, interfaceId, namespace, e);
            return ToolResponse.error("Error: Version '" + version + "' already exists for interface " + interfaceId + ".");
        }
    }
}
