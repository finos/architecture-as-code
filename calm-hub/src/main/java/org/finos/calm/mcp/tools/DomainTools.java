package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/**
 * MCP tool provider for control domain resources. Domains group related control
 * requirements (e.g. 'security') and are independent of namespaces.
 */
@ApplicationScoped
public class DomainTools {

    private static final Logger logger = LoggerFactory.getLogger(DomainTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    DomainStore domainStore;

    @Tool(description = "List all control domains available in CalmHub (e.g. 'security'). Domains group related control requirements.")
    public ToolResponse listDomains() {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled));
        if (err.isPresent()) return err.get();
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

    @Tool(description = "Create a new control domain in CalmHub (e.g. 'security'). Domains group related control requirements and are independent of namespaces.")
    public ToolResponse createDomain(
            @ToolArg(description = "Name for the new domain (alphanumeric with optional hyphens, e.g. 'security')") String name) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateDomain(name));
        if (err.isPresent()) return err.get();

        try {
            Domain created = domainStore.createDomain(name);
            logger.info("Domain created [{}]", created.getName());
            return ToolResponse.success("Domain '" + created.getName() + "' created successfully.");
        } catch (DomainAlreadyExistsException e) {
            logger.warn("Domain already exists [{}]", name, e);
            return ToolResponse.error("Error: Domain '" + name + "' already exists.");
        }
    }
}
