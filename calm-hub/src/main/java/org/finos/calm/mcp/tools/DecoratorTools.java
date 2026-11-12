package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSchemaValidationException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.DecoratorTooLargeException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.ReservedDecoratorTypeException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.security.CalmHubScopes;
import org.finos.calm.services.DecoratorWriteService;
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
@ReadOnlyHubGuard
public class DecoratorTools {

    private static final Logger logger = LoggerFactory.getLogger(DecoratorTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    boolean allowPutOperations;

    @Inject
    DecoratorStore decoratorStore;

    @Inject
    DecoratorWriteService decoratorWriteService;

    @Inject
    SecurityIdentity identity;

    @PermissionsAllowed(CalmHubScopes.READ)
    @Tool(description = "List the current decorators in a namespace (superseded decorators are left out; see getDecoratorHistory), optionally filtered by target architecture path and/or type (e.g. 'threat-model', 'deployment').")
    public ToolResponse listDecorators(
            @ToolArg(description = "The namespace to list decorators from") String namespace,
            @ToolArg(description = "Filter by target path (e.g. '/calm/namespaces/workshop/architectures/1/versions/1-0-0')", required = false) String target,
            @ToolArg(description = "Filter by decorator type (e.g. 'threat-model', 'deployment')", required = false) String type) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateNoWhitespaceFilter(target, 500, "Target filter"),
                () -> McpValidationHelper.validateNoWhitespaceFilter(type, 100, "Type filter"));
        if (err.isPresent()) return err.get();

        try {
            String targetFilter = (target != null && !target.isBlank()) ? target : null;
            String typeFilter = (type != null && !type.isBlank()) ? type : null;

            List<Decorator> decorators = decoratorStore.getDecoratorValuesForNamespace(namespace, targetFilter, typeFilter);
            if (decorators.isEmpty()) {
                return ToolResponse.success("No decorators found in namespace '" + namespace + "'" +
                        (typeFilter != null ? " with type '" + typeFilter + "'" : "") +
                        (targetFilter != null ? " targeting '" + targetFilter + "'" : "") + ".");
            }
            StringBuilder sb = new StringBuilder().append("Decorators in '").append(namespace).append("':\n");
            for (Decorator dec : decorators) {
                sb.append("- unique-id: ").append(dec.getUniqueId())
                  .append(", type: ").append(dec.getType())
                  .append(", target: ").append(dec.getTarget())
                  .append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }

    @PermissionsAllowed(CalmHubScopes.READ)
    @Tool(description = "Get a specific decorator by its numeric ID in a namespace. Returns the full decorator JSON including data payload.")
    public ToolResponse getDecorator(
            @ToolArg(description = "The namespace containing the decorator") String namespace,
            @ToolArg(description = "The decorator numeric ID (positive integer)") int decoratorId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(decoratorId, "Decorator ID"));
        if (err.isPresent()) return err.get();

        try {
            Optional<Decorator> decorator = decoratorStore.getDecoratorById(namespace, decoratorId);
            if (decorator.isEmpty()) {
                return ToolResponse.error("Error: Decorator " + decoratorId + " not found in namespace '" + namespace + "'.");
            }
            Decorator dec = decorator.get();
            return ToolResponse.success("Decorator " + decoratorId + ":\n" +
                    "  unique-id: " + dec.getUniqueId() + "\n" +
                    "  type: " + dec.getType() + "\n" +
                    "  target: " + dec.getTarget() + "\n" +
                    "  target-type: " + dec.getTargetType() + "\n" +
                    "  applies-to: " + dec.getAppliesTo() + "\n" +
                    "  data: " + dec.getData());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }

    @PermissionsAllowed(CalmHubScopes.WRITE)
    @Tool(description = "Create a new decorator in a namespace. Use this to store threat model results, deployments, or other decorator data. Returns the assigned decorator ID. Fails if $schema, unique-id or type is not a string, or target, target-type or applies-to is not an array of strings. Also fails if the decorator type is reserved for other principals, or if the decorator does not match a $schema that Hub knows (the calm-schema decorator Standards).")
    public ToolResponse createDecorator(
            @ToolArg(description = "The namespace to create the decorator in") String namespace,
            @ToolArg(description = "The decorator JSON payload (must include $schema, unique-id, type, target, target-type, applies-to, and data fields)") String decoratorJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateNotBlank(decoratorJson, "Decorator JSON"),
                // Before the parse, so that a body over the limit costs no parse.
                () -> McpValidationHelper.validateMaxBytes(decoratorJson, SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES, "Decorator JSON"),
                () -> McpValidationHelper.validateJson(decoratorJson, "Decorator JSON"));
        if (err.isPresent()) return err.get();

        try {
            int id = decoratorWriteService.createDecorator(DecoratorWriteService.principalName(identity), namespace, decoratorJson);
            logger.info("Decorator created with ID [{}] in namespace [{}]", id, namespace);
            return ToolResponse.success("Decorator created successfully with ID: " + id);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (JsonParseException e) {
            return ToolResponse.error("Error: " + e.getMessage() + ".");
        } catch (DecoratorKeyRefusedException e) {
            return ToolResponse.error("Error: " + e.getMessage() + ".");
        } catch (DecoratorTooLargeException e) {
            return ToolResponse.error("Error: " + e.getMessage() + ".");
        } catch (ReservedDecoratorTypeException e) {
            return reservedTypeError(namespace, null, e);
        } catch (DecoratorSchemaValidationException e) {
            return schemaError(e);
        } catch (StorageWriteException e) {
            return storageError(namespace, e);
        }
    }

    @PermissionsAllowed(CalmHubScopes.WRITE)
    @Tool(description = "Update an existing decorator in a namespace. Returns the updated decorator representation. Fails if $schema, unique-id or type is not a string, or target, target-type or applies-to is not an array of strings. Also fails if the old or new decorator type is reserved for other principals, or if the decorator does not match a $schema that Hub knows. A reserved type is append-only: the update stores a new decorator that supersedes the old one, and returns the new ID.")
    public ToolResponse updateDecorator(
            @ToolArg(description = "The namespace containing the decorator") String namespace,
            @ToolArg(description = "The decorator numeric ID to update (positive integer)") int decoratorId,
            @ToolArg(description = "The updated decorator JSON payload") String decoratorJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.checkMutationAllowed(allowPutOperations),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(decoratorId, "Decorator ID"),
                () -> McpValidationHelper.validateNotBlank(decoratorJson, "Decorator JSON"),
                // Before the parse, so that a body over the limit costs no parse.
                () -> McpValidationHelper.validateMaxBytes(decoratorJson, SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES, "Decorator JSON"),
                () -> McpValidationHelper.validateJson(decoratorJson, "Decorator JSON"));
        if (err.isPresent()) return err.get();

        try {
            int currentId = decoratorWriteService.updateDecorator(DecoratorWriteService.principalName(identity), namespace, decoratorId, decoratorJson);
            logger.info("Decorator [{}] updated in namespace [{}], current decorator [{}]", decoratorId, namespace, currentId);
            String outcome = currentId == decoratorId
                    ? "Decorator " + decoratorId + " updated successfully."
                    : "Decorator " + decoratorId + " superseded by new decorator " + currentId + " (reserved types are append-only).";
            // Return updated representation so callers can verify the change without a follow-up getDecorator call
            Optional<Decorator> updated = decoratorStore.getDecoratorById(namespace, currentId);
            if (updated.isEmpty()) {
                return ToolResponse.success(outcome);
            }
            Decorator dec = updated.get();
            return ToolResponse.success(outcome + "\n" +
                    "  unique-id: " + dec.getUniqueId() + "\n" +
                    "  type: " + dec.getType() + "\n" +
                    "  target: " + dec.getTarget() + "\n" +
                    "  data: " + dec.getData());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (DecoratorNotFoundException e) {
            logger.warn("Decorator [{}] not found in namespace [{}]", decoratorId, namespace, e);
            return ToolResponse.error("Error: Decorator " + decoratorId + " not found in namespace '" + namespace + "'.");
        } catch (DecoratorSupersededException e) {
            logger.warn("Decorator [{}] in namespace [{}] has been superseded", decoratorId, namespace);
            return ToolResponse.error("Error: Decorator " + decoratorId + " has been superseded. Use getDecoratorHistory to find the current decorator.");
        } catch (JsonParseException e) {
            return ToolResponse.error("Error: " + e.getMessage() + ".");
        } catch (DecoratorKeyRefusedException e) {
            return ToolResponse.error("Error: " + e.getMessage() + ".");
        } catch (DecoratorTooLargeException e) {
            return ToolResponse.error("Error: " + e.getMessage() + ".");
        } catch (ReservedDecoratorTypeException e) {
            return reservedTypeError(namespace, decoratorId, e);
        } catch (DecoratorSchemaValidationException e) {
            return schemaError(e);
        } catch (StorageWriteException e) {
            return storageError(namespace, e);
        }
    }

    @PermissionsAllowed(CalmHubScopes.READ)
    @Tool(description = "Get the history of a decorator: the current decorator first, then each older decorator it supersedes. Updates involving reserved types create history entries.")
    public ToolResponse getDecoratorHistory(
            @ToolArg(description = "The namespace containing the decorator") String namespace,
            @ToolArg(description = "The numeric ID of any decorator in the history (positive integer)") int decoratorId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(decoratorId, "Decorator ID"));
        if (err.isPresent()) return err.get();

        try {
            StringBuilder sb = new StringBuilder().append("History of decorator ").append(decoratorId).append(", current first:\n");
            for (DecoratorHistoryEntry entry : decoratorStore.getDecoratorHistory(namespace, decoratorId)) {
                Decorator dec = entry.getDecorator();
                sb.append("- id: ").append(entry.getId())
                  .append(entry.getSupersededBy() == null ? " (current)" : ", superseded by: " + entry.getSupersededBy())
                  .append(dec == null ? "" : ", unique-id: " + dec.getUniqueId() + ", type: " + dec.getType() + ", data: " + dec.getData())
                  .append("\n");
            }
            return ToolResponse.success(sb.toString());
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (DecoratorNotFoundException e) {
            logger.warn("Decorator [{}] not found in namespace [{}]", decoratorId, namespace, e);
            return ToolResponse.error("Error: Decorator " + decoratorId + " not found in namespace '" + namespace + "'.");
        }
    }

    // The decorator ID is null on create.
    private static ToolResponse reservedTypeError(String namespace, Integer decoratorId, ReservedDecoratorTypeException e) {
        logger.warn("Refused a write of reserved decorator type [{}] to decorator [{}] in namespace [{}]", e.getType(), decoratorId, namespace);
        return ToolResponse.error("Error: Decorator type '" + e.getType() + "' is reserved and the caller may not write it.");
    }

    private static ToolResponse storageError(String namespace, StorageWriteException e) {
        logger.error("Decorator write failed in namespace [{}]", namespace, e);
        return ToolResponse.error(e.isCapacityExceeded()
                ? "Error: The namespace has reached the maximum storage size and cannot accept the decorator."
                : "Error: The decorator write could not be completed due to a storage error.");
    }

    private static ToolResponse schemaError(DecoratorSchemaValidationException e) {
        StringBuilder sb = new StringBuilder("Error: Decorator does not match its $schema:\n");
        e.getErrors().forEach(error -> sb.append("- ").append(error.location().isEmpty() ? "(root)" : error.location())
                .append(": ").append(error.error()).append("\n"));
        if (e.getMoreErrors() > 0) {
            sb.append("- and ").append(e.getMoreErrors()).append(" more\n");
        }
        return ToolResponse.error(sb.toString());
    }
}
