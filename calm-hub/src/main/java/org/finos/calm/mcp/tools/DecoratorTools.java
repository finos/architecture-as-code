package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/**
 * MCP tool provider for decorator resources. Exposes CRUD operations on
 * decorators (e.g. threat models, deployments) within CalmHub namespaces
 * via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class DecoratorTools {

    private static final Logger logger = LoggerFactory.getLogger(DecoratorTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "true")
    boolean mcpEnabled;

    @Inject
    DecoratorStore decoratorStore;

    @Tool(description = "List decorators in a namespace, optionally filtered by target architecture path and/or type (e.g. 'threat-model', 'deployment').")
    public String listDecorators(
            @ToolArg(description = "The namespace to list decorators from") String namespace,
            @ToolArg(description = "Optional: filter by target path (e.g. '/calm/namespaces/workshop/architectures/1/versions/1-0-0')") String target,
            @ToolArg(description = "Optional: filter by decorator type (e.g. 'threat-model', 'deployment')") String type) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) return error;
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) return error;

        try {
            String targetFilter = (target != null && !target.isBlank()) ? target : null;
            String typeFilter = (type != null && !type.isBlank()) ? type : null;

            List<Decorator> decorators = decoratorStore.getDecoratorValuesForNamespace(namespace, targetFilter, typeFilter);
            if (decorators.isEmpty()) {
                return "No decorators found in namespace '" + namespace + "'" +
                        (typeFilter != null ? " with type '" + typeFilter + "'" : "") +
                        (targetFilter != null ? " targeting '" + targetFilter + "'" : "") + ".";
            }
            StringBuilder sb = new StringBuilder("Decorators in '" + namespace + "':\n");
            for (Decorator dec : decorators) {
                sb.append("- unique-id: ").append(dec.getUniqueId())
                  .append(", type: ").append(dec.getType())
                  .append(", target: ").append(dec.getTarget())
                  .append("\n");
            }
            return sb.toString();
        } catch (NamespaceNotFoundException e) {
            logger.error("Namespace not found [{}]", namespace, e);
            return "Error: Namespace '" + namespace + "' not found.";
        }
    }

    @Tool(description = "Get a specific decorator by its numeric ID in a namespace. Returns the full decorator JSON including data payload.")
    public String getDecorator(
            @ToolArg(description = "The namespace containing the decorator") String namespace,
            @ToolArg(description = "The decorator numeric ID") int decoratorId) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) return error;
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) return error;

        try {
            // The store may return Optional.empty() for a missing decorator, or throw
            // DecoratorNotFoundException depending on the storage backend. Handle both paths.
            Optional<Decorator> decorator = decoratorStore.getDecoratorById(namespace, decoratorId);
            if (decorator.isEmpty()) {
                return "Decorator " + decoratorId + " not found in namespace '" + namespace + "'.";
            }
            Decorator dec = decorator.get();
            return "Decorator " + decoratorId + ":\n" +
                    "  unique-id: " + dec.getUniqueId() + "\n" +
                    "  type: " + dec.getType() + "\n" +
                    "  target: " + dec.getTarget() + "\n" +
                    "  target-type: " + dec.getTargetType() + "\n" +
                    "  applies-to: " + dec.getAppliesTo() + "\n" +
                    "  data: " + dec.getData();
        } catch (NamespaceNotFoundException e) {
            logger.error("Namespace not found [{}]", namespace, e);
            return "Error: Namespace '" + namespace + "' not found.";
        } catch (DecoratorNotFoundException e) {
            logger.error("Decorator [{}] not found in namespace [{}]", decoratorId, namespace, e);
            return "Error: Decorator " + decoratorId + " not found in namespace '" + namespace + "'.";
        }
    }

    @Tool(description = "Create a new decorator in a namespace. Use this to store threat model results, deployments, or other decorator data. Returns the assigned decorator ID.")
    public String createDecorator(
            @ToolArg(description = "The namespace to create the decorator in") String namespace,
            @ToolArg(description = "The decorator JSON payload (must include $schema, unique-id, type, target, target-type, applies-to, and data fields)") String decoratorJson) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) return error;
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) return error;
        error = McpValidationHelper.validateNotBlank(decoratorJson, "Decorator JSON");
        if (error != null) return error;

        try {
            int id = decoratorStore.createDecorator(namespace, decoratorJson);
            logger.info("Decorator created with ID [{}] in namespace [{}]", id, namespace);
            return "Decorator created successfully with ID: " + id;
        } catch (NamespaceNotFoundException e) {
            logger.error("Namespace not found [{}]", namespace, e);
            return "Error: Namespace '" + namespace + "' not found.";
        }
    }

    @Tool(description = "Update an existing decorator in a namespace.")
    public String updateDecorator(
            @ToolArg(description = "The namespace containing the decorator") String namespace,
            @ToolArg(description = "The decorator numeric ID to update") int decoratorId,
            @ToolArg(description = "The updated decorator JSON payload") String decoratorJson) {
        String error = McpValidationHelper.checkEnabled(mcpEnabled);
        if (error != null) return error;
        error = McpValidationHelper.validateNamespace(namespace);
        if (error != null) return error;
        error = McpValidationHelper.validateNotBlank(decoratorJson, "Decorator JSON");
        if (error != null) return error;

        try {
            decoratorStore.updateDecorator(namespace, decoratorId, decoratorJson);
            logger.info("Decorator [{}] updated in namespace [{}]", decoratorId, namespace);
            return "Decorator " + decoratorId + " updated successfully.";
        } catch (NamespaceNotFoundException e) {
            logger.error("Namespace not found [{}]", namespace, e);
            return "Error: Namespace '" + namespace + "' not found.";
        } catch (DecoratorNotFoundException e) {
            logger.error("Decorator [{}] not found in namespace [{}]", decoratorId, namespace, e);
            return "Error: Decorator " + decoratorId + " not found in namespace '" + namespace + "'.";
        }
    }
}
