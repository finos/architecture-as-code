package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * MCP tool provider for control requirement resources. Exposes read operations
 * on control requirements within CalmHub domains via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class ControlTools {

    private static final Logger logger = LoggerFactory.getLogger(ControlTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "true")
    boolean mcpEnabled;

    @Inject
    ControlStore controlStore;

    @Tool(description = "List all control requirements in a domain (e.g. 'security'). Returns control IDs, names, and descriptions.")
    public ToolResponse listControls(
            @ToolArg(description = "The domain to list controls for (e.g. 'security')") String domain) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateDomain(domain);
        if (error != null) {
            return ToolResponse.error(error);
        }

        try {
            List<ControlDetail> controls = controlStore.getControlsForDomain(domain);
            if (controls.isEmpty()) {
                return ToolResponse.success("No controls found in domain '" + domain + "'.");
            }
            StringBuilder sb = new StringBuilder().append("Controls in domain '").append(domain).append("':\n");
            for (ControlDetail control : controls) {
                sb.append("- ID: ").append(control.getId());
                if (control.getName() != null) {
                    sb.append(", Name: ").append(control.getName());
                }
                if (control.getDescription() != null) {
                    sb.append(", Description: ").append(control.getDescription());
                }
                sb.append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (DomainNotFoundException e) {
            logger.warn("Domain not found [{}]", domain, e);
            return ToolResponse.error("Error: Domain '" + domain + "' not found.");
        }
    }

    @Tool(description = "Get the full JSON content of a specific control requirement version.")
    public ToolResponse getControl(
            @ToolArg(description = "The domain containing the control (e.g. 'security')") String domain,
            @ToolArg(description = "The control ID (positive integer)") int controlId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateDomain(domain);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validatePositiveId(controlId, "Control ID");
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateVersion(version);
        if (error != null) {
            return ToolResponse.error(error);
        }

        try {
            return ToolResponse.success(controlStore.getRequirementForVersion(domain, controlId, version));
        } catch (DomainNotFoundException e) {
            logger.warn("Domain not found [{}]", domain, e);
            return ToolResponse.error("Error: Domain '" + domain + "' not found.");
        } catch (ControlNotFoundException e) {
            logger.warn("Control [{}] not found in domain [{}]", controlId, domain, e);
            return ToolResponse.error("Error: Control " + controlId + " not found in domain '" + domain + "'.");
        } catch (ControlRequirementVersionNotFoundException e) {
            logger.warn("Version [{}] not found for control [{}] in domain [{}]", version, controlId, domain, e);
            return ToolResponse.error("Error: Version '" + version + "' not found for control " + controlId + ".");
        }
    }

    @Tool(description = "List available versions for a specific control requirement.")
    public ToolResponse listControlVersions(
            @ToolArg(description = "The domain containing the control (e.g. 'security')") String domain,
            @ToolArg(description = "The control ID (positive integer)") int controlId) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validateDomain(domain);
        if (error != null) {
            return ToolResponse.error(error);
        }
        error = McpValidationHelper.validatePositiveId(controlId, "Control ID");
        if (error != null) {
            return ToolResponse.error(error);
        }

        try {
            List<String> versions = controlStore.getRequirementVersions(domain, controlId);
            if (versions.isEmpty()) {
                return ToolResponse.success("No versions found for control " + controlId + " in domain '" + domain + "'.");
            }
            StringBuilder sb = new StringBuilder().append("Versions for control ").append(controlId).append(":\n");
            for (String version : versions) {
                sb.append("- ").append(version).append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (DomainNotFoundException e) {
            logger.warn("Domain not found [{}]", domain, e);
            return ToolResponse.error("Error: Domain '" + domain + "' not found.");
        } catch (ControlNotFoundException e) {
            logger.warn("Control [{}] not found in domain [{}]", controlId, domain, e);
            return ToolResponse.error("Error: Control " + controlId + " not found in domain '" + domain + "'.");
        }
    }
}
