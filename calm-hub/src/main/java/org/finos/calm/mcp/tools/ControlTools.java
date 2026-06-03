package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * MCP tool provider for control requirement resources. Exposes read operations
 * on control requirements within CalmHub domains via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class ControlTools {

    private static final Logger logger = LoggerFactory.getLogger(ControlTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    ControlStore controlStore;

    @Tool(description = "List all control requirements in a domain (e.g. 'security'). Returns control IDs, names, and descriptions.")
    public ToolResponse listControls(
            @ToolArg(description = "The domain to list controls for (e.g. 'security')") String domain) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateDomain(domain));
        if (err.isPresent()) return err.get();

        try {
            List<ControlDetail> controls = controlStore.getControlsForDomain(domain);
            List<McpResponseFormatter.ResourceSummary> summaries = controls.stream()
                    .map(c -> new McpResponseFormatter.ResourceSummary(c.getId(), c.getName(), c.getDescription()))
                    .collect(Collectors.toList());
            return McpResponseFormatter.formatResourceList("control", "domain", domain, summaries);
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
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateDomain(domain),
                () -> McpValidationHelper.validatePositiveId(controlId, "Control ID"),
                () -> McpValidationHelper.validateVersion(version));
        if (err.isPresent()) return err.get();

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
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateDomain(domain),
                () -> McpValidationHelper.validatePositiveId(controlId, "Control ID"));
        if (err.isPresent()) return err.get();

        try {
            List<String> versions = controlStore.getRequirementVersions(domain, controlId);
            return McpResponseFormatter.formatVersionList("control", controlId, "domain", domain, versions);
        } catch (DomainNotFoundException e) {
            logger.warn("Domain not found [{}]", domain, e);
            return ToolResponse.error("Error: Domain '" + domain + "' not found.");
        } catch (ControlNotFoundException e) {
            logger.warn("Control [{}] not found in domain [{}]", controlId, domain, e);
            return ToolResponse.error("Error: Control " + controlId + " not found in domain '" + domain + "'.");
        }
    }

    @Tool(description = "Create a new control requirement in a domain. The requirement is created with an initial version 1.0.0 from the supplied requirement JSON. Returns the assigned control ID.")
    public ToolResponse createControlRequirement(
            @ToolArg(description = "The domain to create the control requirement in (e.g. 'security')") String domain,
            @ToolArg(description = "The name of the control requirement") String name,
            @ToolArg(description = "A description of the control requirement") String description,
            @ToolArg(description = "The full control requirement JSON content") String requirementJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateDomain(domain),
                () -> McpValidationHelper.validateNotBlank(name, "Name"),
                () -> McpValidationHelper.validateMaxLength(name, McpValidationHelper.MAX_NAME_LENGTH, "Name"),
                () -> McpValidationHelper.validateNotBlank(description, "Description"),
                () -> McpValidationHelper.validateDescriptionLength(description, "Description"),
                () -> McpValidationHelper.validateNotBlank(requirementJson, "Requirement JSON"),
                () -> McpValidationHelper.validateMaxLength(requirementJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Requirement JSON"),
                () -> McpValidationHelper.validateJson(requirementJson, "Requirement JSON"));
        if (err.isPresent()) return err.get();

        try {
            CreateControlRequirement request = new CreateControlRequirement(name, description, requirementJson);
            ControlDetail created = controlStore.createControlRequirement(request, domain);
            logger.info("Control requirement created with ID [{}] in domain [{}]", created.getId(), domain);
            return ToolResponse.success("Control requirement created successfully with ID: " + created.getId() + " in domain '" + domain + "'.");
        } catch (DomainNotFoundException e) {
            logger.warn("Domain not found [{}]", domain, e);
            return ToolResponse.error("Error: Domain '" + domain + "' not found.");
        }
    }

    @Tool(description = "Create a new control configuration for an existing control requirement. The configuration is created with an initial version 1.0.0 from the supplied configuration JSON. Returns the assigned configuration ID.")
    public ToolResponse createControlConfiguration(
            @ToolArg(description = "The domain containing the control (e.g. 'security')") String domain,
            @ToolArg(description = "The control ID (positive integer) to create a configuration for") int controlId,
            @ToolArg(description = "The full control configuration JSON content") String configurationJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateDomain(domain),
                () -> McpValidationHelper.validatePositiveId(controlId, "Control ID"),
                () -> McpValidationHelper.validateNotBlank(configurationJson, "Configuration JSON"),
                () -> McpValidationHelper.validateMaxLength(configurationJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Configuration JSON"),
                () -> McpValidationHelper.validateJson(configurationJson, "Configuration JSON"));
        if (err.isPresent()) return err.get();

        try {
            CreateControlConfiguration request = new CreateControlConfiguration(configurationJson);
            int configurationId = controlStore.createControlConfiguration(request, domain, controlId);
            logger.info("Control configuration created with ID [{}] for control [{}] in domain [{}]", configurationId, controlId, domain);
            return ToolResponse.success("Control configuration created successfully with ID: " + configurationId + " for control " + controlId + " in domain '" + domain + "'.");
        } catch (DomainNotFoundException e) {
            logger.warn("Domain not found [{}]", domain, e);
            return ToolResponse.error("Error: Domain '" + domain + "' not found.");
        } catch (ControlNotFoundException e) {
            logger.warn("Control [{}] not found in domain [{}]", controlId, domain, e);
            return ToolResponse.error("Error: Control " + controlId + " not found in domain '" + domain + "'.");
        }
    }
}
