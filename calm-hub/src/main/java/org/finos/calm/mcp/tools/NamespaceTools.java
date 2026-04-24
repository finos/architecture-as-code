package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.NamespaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * MCP tool provider for namespace and domain resources. Exposes listing and
 * creation of namespaces and listing of control domains via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class NamespaceTools {

    private static final Logger logger = LoggerFactory.getLogger(NamespaceTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "true")
    boolean mcpEnabled;

    @Inject
    NamespaceStore namespaceStore;

    @Inject
    DomainStore domainStore;

    @Tool(description = "List all namespaces available in CalmHub. Returns namespace names and descriptions.")
    public ToolResponse listNamespaces() {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
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
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateNamespace(name);
        if (error != null) {
            return ToolResponse.error(error);
        }
        if (description != null) {
            error = McpValidationHelper.validateDescriptionLength(description, "Description");
            if (error != null) {
                return ToolResponse.error(error);
            }
        }

        try {
            namespaceStore.createNamespace(name, description);
            logger.info("Namespace created [{}]", name);
            return ToolResponse.success("Namespace '" + name + "' created successfully.");
        } catch (NamespaceAlreadyExistsException e) {
            logger.warn("Namespace already exists [{}]", name, e);
            return ToolResponse.error("Error: Namespace '" + name + "' already exists.");
        }
    }

    @Tool(description = "List all control domains available in CalmHub (e.g. 'security').")
    public ToolResponse listDomains() {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
        List<String> domains = domainStore.getDomains();
        if (domains.isEmpty()) {
            return ToolResponse.success("No domains found.");
        }
        StringBuilder sb = new StringBuilder("Domains:\n");
        for (String domain : domains) {
            sb.append("- ").append(domain).append("\n");
        }
        return ToolResponse.success(sb.toString());
    }
}
