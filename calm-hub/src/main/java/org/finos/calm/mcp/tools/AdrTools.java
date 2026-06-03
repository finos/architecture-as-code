package org.finos.calm.mcp.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.NewAdrRequest;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrPersistenceException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * MCP tool provider for ADR (Architecture Decision Record) resources.
 * Exposes operations to create, retrieve, update and manage ADR revisions
 * and status transitions within CalmHub namespaces via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class AdrTools {

    private static final Logger logger = LoggerFactory.getLogger(AdrTools.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().registerModule(new JavaTimeModule());

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    boolean allowPutOperations;

    @Inject
    AdrStore adrStore;

    @Tool(description = "List all ADRs in a CalmHub namespace. Returns ADR IDs, titles, and current status.")
    public ToolResponse listAdrs(
            @ToolArg(description = "The namespace to list ADRs from (e.g. 'workshop', 'finos')") String namespace) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace));
        if (err.isPresent()) return err.get();

        try {
            var adrs = adrStore.getAdrsForNamespace(namespace);
            List<McpResponseFormatter.AdrSummary> summaries = adrs.stream()
                    .map(a -> new McpResponseFormatter.AdrSummary(a.getId(), a.getTitle(), a.getStatus()))
                    .collect(Collectors.toList());
            return McpResponseFormatter.formatAdrList(namespace, summaries);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        }
    }

    @Tool(description = "Get the latest revision of an ADR. Returns the full ADR content as a JSON object.")
    public ToolResponse getAdr(
            @ToolArg(description = "The namespace containing the ADR") String namespace,
            @ToolArg(description = "The ADR ID (positive integer)") int adrId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(adrId, "ADR ID"));
        if (err.isPresent()) return err.get();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(adrId)
                .build();

        try {
            AdrMeta result = adrStore.getAdr(adrMeta);
            return ToolResponse.success(OBJECT_MAPPER.writeValueAsString(result));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (AdrNotFoundException e) {
            logger.warn("ADR [{}] not found in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: ADR " + adrId + " not found in namespace '" + namespace + "'.");
        } catch (AdrRevisionNotFoundException e) {
            logger.warn("No revisions found for ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: No revisions found for ADR " + adrId + ".");
        } catch (AdrParseException e) {
            logger.warn("Failed to parse ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: Failed to parse ADR " + adrId + ".");
        } catch (Exception e) {
            logger.error("Unexpected error getting ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: Unexpected error retrieving ADR " + adrId + ".");
        }
    }

    @Tool(description = "List all revision numbers for an ADR.")
    public ToolResponse listAdrRevisions(
            @ToolArg(description = "The namespace containing the ADR") String namespace,
            @ToolArg(description = "The ADR ID (positive integer)") int adrId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(adrId, "ADR ID"));
        if (err.isPresent()) return err.get();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(adrId)
                .build();

        try {
            List<Integer> revisions = adrStore.getAdrRevisions(adrMeta);
            return McpResponseFormatter.formatRevisionList("ADR", adrId, namespace, revisions);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (AdrNotFoundException e) {
            logger.warn("ADR [{}] not found in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: ADR " + adrId + " not found in namespace '" + namespace + "'.");
        } catch (AdrRevisionNotFoundException e) {
            logger.warn("No revisions found for ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: No revisions found for ADR " + adrId + ".");
        }
    }

    @Tool(description = "Get a specific revision of an ADR. Returns the ADR content at that revision as a JSON object.")
    public ToolResponse getAdrRevision(
            @ToolArg(description = "The namespace containing the ADR") String namespace,
            @ToolArg(description = "The ADR ID (positive integer)") int adrId,
            @ToolArg(description = "The revision number (positive integer)") int revision) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(adrId, "ADR ID"),
                () -> McpValidationHelper.validatePositiveId(revision, "Revision"));
        if (err.isPresent()) return err.get();

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(adrId)
                .setRevision(revision)
                .build();

        try {
            AdrMeta result = adrStore.getAdrRevision(adrMeta);
            return ToolResponse.success(OBJECT_MAPPER.writeValueAsString(result));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (AdrNotFoundException e) {
            logger.warn("ADR [{}] not found in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: ADR " + adrId + " not found in namespace '" + namespace + "'.");
        } catch (AdrRevisionNotFoundException e) {
            logger.warn("Revision [{}] not found for ADR [{}] in namespace [{}]", revision, adrId, namespace, e);
            return ToolResponse.error("Error: Revision " + revision + " not found for ADR " + adrId + ".");
        } catch (AdrParseException e) {
            logger.warn("Failed to parse ADR [{}] revision [{}] in namespace [{}]", adrId, revision, namespace, e);
            return ToolResponse.error("Error: Failed to parse ADR " + adrId + " at revision " + revision + ".");
        } catch (Exception e) {
            logger.error("Unexpected error getting ADR [{}] revision [{}] in namespace [{}]", adrId, revision, namespace, e);
            return ToolResponse.error("Error: Unexpected error retrieving ADR " + adrId + " revision " + revision + ".");
        }
    }

    @Tool(description = "Create a new ADR in draft status. Accept the ADR content as a JSON string matching the NewAdrRequest structure: {\"title\":\"...\",\"contextAndProblemStatement\":\"...\",\"decisionDrivers\":[],\"consideredOptions\":[],\"decisionOutcome\":{},\"links\":[]}. Returns the allocated ADR ID.")
    public ToolResponse createAdr(
            @ToolArg(description = "The namespace to create the ADR in") String namespace,
            @ToolArg(description = "The ADR content as JSON (NewAdrRequest structure)") String adrJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateNotBlank(adrJson, "ADR JSON"),
                () -> McpValidationHelper.validateMaxLength(adrJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "ADR JSON"),
                () -> McpValidationHelper.validateJson(adrJson, "ADR JSON"));
        if (err.isPresent()) return err.get();

        try {
            NewAdrRequest newAdrRequest = OBJECT_MAPPER.readValue(adrJson, NewAdrRequest.class);
            Adr adr = new Adr.AdrBuilder(newAdrRequest)
                    .setStatus(Status.draft)
                    .setCreationDateTime(LocalDateTime.now())
                    .setUpdateDateTime(LocalDateTime.now())
                    .build();

            AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                    .setNamespace(namespace)
                    .setRevision(1)
                    .setAdr(adr)
                    .build();

            AdrMeta result = adrStore.createAdrForNamespace(adrMeta);
            logger.info("ADR created with ID [{}] in namespace [{}]", result.getId(), namespace);
            return ToolResponse.success("ADR created successfully with ID: " + result.getId() + " (revision 1) in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (AdrParseException e) {
            logger.warn("ADR parse error in namespace [{}]", namespace, e);
            return ToolResponse.error("Error: Failed to parse ADR content. Check the JSON structure.");
        } catch (Exception e) {
            logger.error("Unexpected error creating ADR in namespace [{}]", namespace, e);
            return ToolResponse.error("Error: Unexpected error creating ADR.");
        }
    }

    @Tool(description = "Update an existing ADR's content. Creates a new revision. Accepts the ADR content as a JSON string matching the NewAdrRequest structure.")
    public ToolResponse updateAdr(
            @ToolArg(description = "The namespace containing the ADR") String namespace,
            @ToolArg(description = "The ADR ID (positive integer)") int adrId,
            @ToolArg(description = "The updated ADR content as JSON (NewAdrRequest structure)") String adrJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.checkMutationAllowed(allowPutOperations),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(adrId, "ADR ID"),
                () -> McpValidationHelper.validateNotBlank(adrJson, "ADR JSON"),
                () -> McpValidationHelper.validateMaxLength(adrJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "ADR JSON"),
                () -> McpValidationHelper.validateJson(adrJson, "ADR JSON"));
        if (err.isPresent()) return err.get();

        try {
            NewAdrRequest newAdrRequest = OBJECT_MAPPER.readValue(adrJson, NewAdrRequest.class);
            Adr adr = new Adr.AdrBuilder(newAdrRequest)
                    .setUpdateDateTime(LocalDateTime.now())
                    .build();

            AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                    .setNamespace(namespace)
                    .setId(adrId)
                    .setAdr(adr)
                    .build();

            AdrMeta result = adrStore.updateAdrForNamespace(adrMeta);
            logger.info("ADR [{}] updated in namespace [{}], new revision [{}]", adrId, namespace, result.getRevision());
            return ToolResponse.success("ADR " + adrId + " updated successfully (revision " + result.getRevision() + ") in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (AdrNotFoundException e) {
            logger.warn("ADR [{}] not found in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: ADR " + adrId + " not found in namespace '" + namespace + "'.");
        } catch (AdrRevisionNotFoundException e) {
            logger.warn("No revisions found for ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: No revisions found for ADR " + adrId + ".");
        } catch (AdrParseException e) {
            logger.warn("ADR parse error for ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: Failed to parse ADR content. Check the JSON structure.");
        } catch (Exception e) {
            logger.error("Unexpected error updating ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: Unexpected error updating ADR " + adrId + ".");
        }
    }

    @Tool(description = "Update the status of an ADR. Valid statuses: draft, proposed, accepted, superseded, rejected, deprecated.")
    public ToolResponse updateAdrStatus(
            @ToolArg(description = "The namespace containing the ADR") String namespace,
            @ToolArg(description = "The ADR ID (positive integer)") int adrId,
            @ToolArg(description = "The new status (draft, proposed, accepted, superseded, rejected, deprecated)") String status) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.checkMutationAllowed(allowPutOperations),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(adrId, "ADR ID"),
                () -> McpValidationHelper.validateNotBlank(status, "Status"),
                () -> McpValidationHelper.validateEnum(status, Status.class, "status"));
        if (err.isPresent()) return err.get();

        Status adrStatus = McpValidationHelper.parseEnum(status, Status.class);

        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(adrId)
                .build();

        try {
            adrStore.updateAdrStatus(adrMeta, adrStatus);
            logger.info("ADR [{}] status updated to [{}] in namespace [{}]", adrId, adrStatus, namespace);
            return ToolResponse.success("ADR " + adrId + " status updated to '" + adrStatus + "' in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
        } catch (AdrNotFoundException e) {
            logger.warn("ADR [{}] not found in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: ADR " + adrId + " not found in namespace '" + namespace + "'.");
        } catch (AdrRevisionNotFoundException e) {
            logger.warn("No revisions found for ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: No revisions found for ADR " + adrId + ".");
        } catch (AdrPersistenceException e) {
            logger.warn("Persistence error updating status for ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: Failed to persist status update for ADR " + adrId + ".");
        } catch (AdrParseException e) {
            logger.warn("Parse error updating status for ADR [{}] in namespace [{}]", adrId, namespace, e);
            return ToolResponse.error("Error: Failed to parse ADR " + adrId + " when updating status.");
        }
    }
}
