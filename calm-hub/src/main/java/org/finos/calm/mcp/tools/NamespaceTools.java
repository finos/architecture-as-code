package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.NamespaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/**
 * MCP tool provider for namespace resources. Exposes listing and
 * creation of namespaces via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class NamespaceTools {

    private static final Logger logger = LoggerFactory.getLogger(NamespaceTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    NamespaceStore namespaceStore;

    @Tool(description = "List all namespaces available in CalmHub. Returns namespace names and descriptions.")
    public ToolResponse listNamespaces() {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled));
        if (err.isPresent()) return err.get();
        List<NamespaceInfo> namespaces = namespaceStore.getNamespaces();
        if (namespaces.isEmpty()) {
            return ToolResponse.success("No namespaces found.");
        }
        StringBuilder sb = new StringBuilder("Namespaces:\n");
        for (NamespaceInfo ns : namespaces) {
            sb.append("- ").append(ns.getName());
            if (ns.getDescription() != null && !ns.getDescription().isEmpty()) {
                sb.append(": ").append(ns.getDescription());
            }
            sb.append("\n");
        }
        return ToolResponse.success(sb.toString());
    }

    @Tool(description = "Create a new namespace in CalmHub.")
    public ToolResponse createNamespace(
            @ToolArg(description = "Name for the new namespace (alphanumeric with optional hyphens and dotted segments, case-sensitive, e.g. 'my-org.team1')") String name,
            @ToolArg(description = "Optional description of the namespace", required = false) String description) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(name),
                () -> McpValidationHelper.validateDescriptionLength(description, "Description"));
        if (err.isPresent()) return err.get();

        try {
            namespaceStore.createNamespace(name, description);
            logger.info("Namespace created [{}]", name);
            return ToolResponse.success("Namespace '" + name + "' created successfully.");
        } catch (NamespaceAlreadyExistsException e) {
            logger.warn("Namespace already exists [{}]", name, e);
            return ToolResponse.error("Error: Namespace '" + name + "' already exists.");
        }
    }

}
