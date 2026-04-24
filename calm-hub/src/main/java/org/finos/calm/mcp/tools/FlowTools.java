package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.flow.NamespaceFlowSummary;
import org.finos.calm.store.FlowStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * MCP tool provider for flow resources. Exposes read operations on
 * flows within CalmHub namespaces via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class FlowTools {

    private static final Logger logger = LoggerFactory.getLogger(FlowTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "true")
    boolean mcpEnabled;

    @Inject
    FlowStore flowStore;

    @Tool(description = "List all flows in a CalmHub namespace.")
    public ToolResponse listFlows(
            @ToolArg(description = "The namespace to list flows from") String namespace) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) return ToolResponse.error(error);
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) return ToolResponse.error(error);

        try {
            List<NamespaceFlowSummary> flows = flowStore.getFlowsForNamespace(namespace);
            if (flows.isEmpty()) {
                return ToolResponse.success("No flows found in namespace '" + namespace + "'.");
            }
            StringBuilder sb = new StringBuilder("Flows in '" + namespace + "':\n");
            for (NamespaceFlowSummary flow : flows) {
                sb.append("- ID: ").append(flow.getId());
                if (flow.getName() != null) {
                    sb.append(", Name: ").append(flow.getName());
                }
                sb.append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }

    @Tool(description = "Get the full JSON content of a specific flow version.")
    public ToolResponse getFlow(
            @ToolArg(description = "The namespace containing the flow") String namespace,
            @ToolArg(description = "The flow ID (positive integer)") int flowId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) return ToolResponse.error(error);
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) return ToolResponse.error(error);
        error = McpValidationHelper.validatePositiveId(flowId, "Flow ID");
        if (error != null) return ToolResponse.error(error);
        error = McpValidationHelper.validateVersion(version);
        if (error != null) return ToolResponse.error(error);

        try {
            Flow flow = new Flow.FlowBuilder()
                    .setNamespace(namespace)
                    .setId(flowId)
                    .setVersion(version)
                    .build();
            return ToolResponse.success(flowStore.getFlowForVersion(flow));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (FlowNotFoundException e) {
            logger.warn("Flow [{}] not found in namespace [{}]", flowId, namespace, e);
            return ToolResponse.error("Error: Flow " + flowId + " not found in namespace '" + namespace + "'.");
        } catch (FlowVersionNotFoundException e) {
            logger.warn("Version [{}] not found for flow [{}] in namespace [{}]", version, flowId, namespace, e);
            return ToolResponse.error("Error: Version '" + version + "' not found for flow " + flowId + ".");
        }
    }
}
