package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.TimelineNotFoundException;
import org.finos.calm.domain.exception.TimelineVersionExistsException;
import org.finos.calm.domain.exception.TimelineVersionNotFoundException;
import org.finos.calm.domain.timeline.CreateTimelineRequest;
import org.finos.calm.domain.timeline.NamespaceTimelineSummary;
import org.finos.calm.domain.timeline.Timeline;
import org.finos.calm.store.TimelineStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/**
 * MCP tool provider for timeline resources. Exposes CRUD operations on
 * timelines within CalmHub namespaces via the Quarkiverse MCP server.
 */
@ApplicationScoped
public class TimelineTools {

    private static final Logger logger = LoggerFactory.getLogger(TimelineTools.class);

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    @ConfigProperty(name = "allow.put.operations", defaultValue = "false")
    boolean allowPutOperations;

    @Inject
    TimelineStore timelineStore;

    @Tool(description = "List all timelines in a CalmHub namespace. Returns timeline IDs, names, and descriptions.")
    public ToolResponse listTimelines(
            @ToolArg(description = "The namespace to list timelines from (e.g. 'workshop', 'finos')") String namespace) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace));
        if (err.isPresent()) return err.get();

        try {
            List<NamespaceTimelineSummary> timelines = timelineStore.getTimelinesForNamespace(namespace);
            List<McpResponseFormatter.ResourceSummary> summaries = timelines.stream()
                    .map(t -> new McpResponseFormatter.ResourceSummary(t.getId(), t.getName(), t.getDescription()))
                    .toList();
            return McpResponseFormatter.formatResourceList("timeline", namespace, summaries);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    @Tool(description = "List available versions of a timeline in a CalmHub namespace.")
    public ToolResponse listTimelineVersions(
            @ToolArg(description = "The namespace containing the timeline") String namespace,
            @ToolArg(description = "The timeline ID (positive integer)") int timelineId) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(timelineId, "Timeline ID"));
        if (err.isPresent()) return err.get();

        try {
            Timeline timeline = new Timeline.TimelineBuilder()
                    .setNamespace(namespace)
                    .setId(timelineId)
                    .build();
            List<String> versions = timelineStore.getTimelineVersions(timeline);
            return McpResponseFormatter.formatVersionList("timeline", timelineId, namespace, versions);
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (TimelineNotFoundException e) {
            logger.warn("Timeline [{}] not found in namespace [{}]", timelineId, namespace, e);
            return McpResponseFormatter.entityNotFound("timeline", timelineId, namespace);
        }
    }

    @Tool(description = "Get the full JSON content of a specific timeline version.")
    public ToolResponse getTimeline(
            @ToolArg(description = "The namespace containing the timeline") String namespace,
            @ToolArg(description = "The timeline ID (positive integer)") int timelineId,
            @ToolArg(description = "The version string (e.g. '1.0.0')") String version) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(timelineId, "Timeline ID"),
                () -> McpValidationHelper.validateVersion(version));
        if (err.isPresent()) return err.get();

        try {
            Timeline timeline = new Timeline.TimelineBuilder()
                    .setNamespace(namespace)
                    .setId(timelineId)
                    .setVersion(version)
                    .build();
            return ToolResponse.success(timelineStore.getTimelineForVersion(timeline));
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (TimelineNotFoundException e) {
            logger.warn("Timeline [{}] not found in namespace [{}]", timelineId, namespace, e);
            return McpResponseFormatter.entityNotFound("timeline", timelineId, namespace);
        } catch (TimelineVersionNotFoundException e) {
            logger.warn("Version [{}] not found for timeline [{}] in namespace [{}]", version, timelineId, namespace, e);
            return McpResponseFormatter.versionNotFound("timeline", timelineId, version);
        }
    }

    @Tool(description = "Create a new timeline in a namespace. Returns the allocated timeline ID and version.")
    public ToolResponse createTimeline(
            @ToolArg(description = "The namespace to create the timeline in") String namespace,
            @ToolArg(description = "The name of the timeline") String name,
            @ToolArg(description = "A description of the timeline") String description,
            @ToolArg(description = "The full CALM timeline JSON content") String timelineJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validateNotBlank(name, "Timeline name"),
                () -> McpValidationHelper.validateMaxLength(name, McpValidationHelper.MAX_NAME_LENGTH, "Timeline name"),
                () -> McpValidationHelper.validateDescriptionLength(description, "Timeline description"),
                () -> McpValidationHelper.validateNotBlank(timelineJson, "Timeline JSON"),
                () -> McpValidationHelper.validateMaxLength(timelineJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Timeline JSON"),
                () -> McpValidationHelper.validateJson(timelineJson, "Timeline JSON"));
        if (err.isPresent()) return err.get();

        try {
            CreateTimelineRequest request = new CreateTimelineRequest(name, description, timelineJson);
            Timeline result = timelineStore.createTimelineForNamespace(request, namespace);
            logger.info("Timeline created with ID [{}] in namespace [{}]", result.getId(), namespace);
            return ToolResponse.success("Timeline created successfully with ID: " + result.getId() + " (version " + result.getDotVersion() + ") in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        }
    }

    @Tool(description = "Publish a new version of an existing timeline. Use this to add a new semantic version (e.g. '1.1.0') against an existing timeline ID without allocating a new identity.")
    public ToolResponse createTimelineVersion(
            @ToolArg(description = "The namespace containing the timeline") String namespace,
            @ToolArg(description = "The timeline ID to publish a new version for (positive integer)") int timelineId,
            @ToolArg(description = "The new version string to publish (e.g. '1.1.0')") String version,
            @ToolArg(description = "The full CALM timeline JSON content for this version") String timelineJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(timelineId, "Timeline ID"),
                () -> McpValidationHelper.validateVersion(version),
                () -> McpValidationHelper.validateNotBlank(timelineJson, "Timeline JSON"),
                () -> McpValidationHelper.validateMaxLength(timelineJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Timeline JSON"),
                () -> McpValidationHelper.validateJson(timelineJson, "Timeline JSON"));
        if (err.isPresent()) return err.get();

        try {
            Timeline timeline = new Timeline.TimelineBuilder()
                    .setNamespace(namespace)
                    .setId(timelineId)
                    .setVersion(version)
                    .setTimeline(timelineJson)
                    .build();
            timelineStore.createTimelineForVersion(timeline);
            logger.info("Timeline [{}] version [{}] created in namespace [{}]", timelineId, version, namespace);
            return ToolResponse.success("Timeline " + timelineId + " version '" + version + "' created successfully in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (TimelineNotFoundException e) {
            logger.warn("Timeline [{}] not found in namespace [{}]", timelineId, namespace, e);
            return McpResponseFormatter.entityNotFound("timeline", timelineId, namespace);
        } catch (TimelineVersionExistsException e) {
            logger.warn("Version [{}] already exists for timeline [{}] in namespace [{}]", version, timelineId, namespace, e);
            return ToolResponse.error("Error: Version '" + version + "' already exists for timeline " + timelineId + ".");
        }
    }

    @Tool(description = "Update the content of an existing timeline version. Requires PUT operations to be enabled on this CalmHub instance.")
    public ToolResponse updateTimeline(
            @ToolArg(description = "The namespace containing the timeline") String namespace,
            @ToolArg(description = "The timeline ID (positive integer)") int timelineId,
            @ToolArg(description = "The version string to update (e.g. '1.0.0')") String version,
            @ToolArg(description = "The updated CALM timeline JSON content") String timelineJson) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled),
                () -> McpValidationHelper.checkMutationAllowed(allowPutOperations),
                () -> McpValidationHelper.validateNamespace(namespace),
                () -> McpValidationHelper.validatePositiveId(timelineId, "Timeline ID"),
                () -> McpValidationHelper.validateVersion(version),
                () -> McpValidationHelper.validateNotBlank(timelineJson, "Timeline JSON"),
                () -> McpValidationHelper.validateMaxLength(timelineJson, McpValidationHelper.MAX_JSON_PAYLOAD_LENGTH, "Timeline JSON"),
                () -> McpValidationHelper.validateJson(timelineJson, "Timeline JSON"));
        if (err.isPresent()) return err.get();

        try {
            Timeline timeline = new Timeline.TimelineBuilder()
                    .setNamespace(namespace)
                    .setId(timelineId)
                    .setVersion(version)
                    .setTimeline(timelineJson)
                    .build();
            timelineStore.updateTimelineForVersion(timeline);
            logger.info("Timeline [{}] version [{}] updated in namespace [{}]", timelineId, version, namespace);
            return ToolResponse.success("Timeline " + timelineId + " version '" + version + "' updated successfully in namespace '" + namespace + "'.");
        } catch (NamespaceNotFoundException e) {
            logger.warn("Namespace not found [{}]", namespace, e);
            return McpResponseFormatter.namespaceNotFound(namespace);
        } catch (TimelineNotFoundException e) {
            logger.warn("Timeline [{}] not found in namespace [{}]", timelineId, namespace, e);
            return McpResponseFormatter.entityNotFound("timeline", timelineId, namespace);
        }
    }
}
