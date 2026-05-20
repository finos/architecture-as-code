package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.ToolResponse;

import java.util.List;

/**
 * Utility class providing consistent response formatting for MCP tool responses.
 * Eliminates repeated StringBuilder list-building patterns across tool implementations.
 */
public final class McpResponseFormatter {

    private McpResponseFormatter() {}

    /**
     * Lightweight projection used to pass resource metadata to the formatter,
     * decoupled from any specific domain type.
     */
    public record ResourceSummary(Integer id, String name, String description) {}

    /**
     * Lightweight projection for ADR list entries, carrying the status field
     * that distinguishes ADRs from generic name/description resources.
     */
    public record AdrSummary(Integer id, String title, String status) {}

    /**
     * Formats a list of resource summaries for a namespace. Delegates to the
     * container-aware overload with {@code "namespace"} as the container type.
     */
    public static ToolResponse formatResourceList(String resourceType, String namespace, List<ResourceSummary> summaries) {
        return formatResourceList(resourceType, "namespace", namespace, summaries);
    }

    /**
     * Formats a list of resource summaries for any container type (e.g. namespace or domain).
     * Capitalises the resource type for the header (e.g. "control" → "Controls in 'security':").
     */
    public static ToolResponse formatResourceList(String resourceType, String containerType, String containerName, List<ResourceSummary> summaries) {
        if (summaries.isEmpty()) {
            return ToolResponse.success("No " + resourceType + "s found in " + containerType + " '" + containerName + "'.");
        }
        String capitalised = Character.toUpperCase(resourceType.charAt(0)) + resourceType.substring(1);
        StringBuilder sb = new StringBuilder().append(capitalised).append("s in '").append(containerName).append("':\n");
        for (ResourceSummary s : summaries) {
            sb.append("- ID: ").append(s.id());
            if (s.name() != null) {
                sb.append(", Name: ").append(s.name());
            }
            if (s.description() != null) {
                sb.append(", Description: ").append(s.description());
            }
            sb.append("\n");
        }
        return ToolResponse.success(sb.toString());
    }

    /**
     * Formats a version list for a given resource in a namespace. Delegates to the
     * container-aware overload with {@code "namespace"} as the container type.
     */
    public static ToolResponse formatVersionList(String resourceType, int id, String namespace, List<String> versions) {
        return formatVersionList(resourceType, id, "namespace", namespace, versions);
    }

    /**
     * Formats a version list for a given resource in any container type (e.g. namespace or domain).
     * When the list is empty the message includes the container for diagnostic context.
     */
    public static ToolResponse formatVersionList(String resourceType, int id, String containerType, String containerName, List<String> versions) {
        if (versions.isEmpty()) {
            return ToolResponse.success("No versions found for " + resourceType + " " + id + " in " + containerType + " '" + containerName + "'.");
        }
        StringBuilder sb = new StringBuilder().append("Versions for ").append(resourceType).append(" ").append(id).append(":\n");
        for (String version : versions) {
            sb.append("- ").append(version).append("\n");
        }
        return ToolResponse.success(sb.toString());
    }

    /**
     * Formats a list of ADR summaries for a namespace, including each ADR's status.
     */
    public static ToolResponse formatAdrList(String namespace, List<AdrSummary> summaries) {
        if (summaries.isEmpty()) {
            return ToolResponse.success("No ADRs found in namespace '" + namespace + "'.");
        }
        StringBuilder sb = new StringBuilder("ADRs in '").append(namespace).append("':\n");
        for (AdrSummary s : summaries) {
            sb.append("- ID: ").append(s.id())
              .append(", Title: ").append(s.title())
              .append(", Status: ").append(s.status())
              .append("\n");
        }
        return ToolResponse.success(sb.toString());
    }

    /**
     * Formats an integer revision list for a resource in a namespace.
     */
    public static ToolResponse formatRevisionList(String resourceType, int id, String namespace, List<Integer> revisions) {
        if (revisions.isEmpty()) {
            return ToolResponse.success("No revisions found for " + resourceType + " " + id + " in namespace '" + namespace + "'.");
        }
        StringBuilder sb = new StringBuilder("Revisions for ").append(resourceType).append(" ").append(id).append(":\n");
        for (Integer revision : revisions) {
            sb.append("- ").append(revision).append("\n");
        }
        return ToolResponse.success(sb.toString());
    }

    /**
     * Standard error response when a namespace cannot be found.
     */
    public static ToolResponse namespaceNotFound(String namespace) {
        return ToolResponse.error("Error: Namespace '" + namespace + "' not found.");
    }

    /**
     * Standard error response when a named entity cannot be found within a namespace.
     * Capitalises the resource type label (e.g. "architecture" → "Architecture 1 not found").
     */
    public static ToolResponse entityNotFound(String resourceType, int id, String namespace) {
        String capitalised = Character.toUpperCase(resourceType.charAt(0)) + resourceType.substring(1);
        return ToolResponse.error("Error: " + capitalised + " " + id + " not found in namespace '" + namespace + "'.");
    }

    /**
     * Standard error response when a specific version of an entity cannot be found.
     */
    public static ToolResponse versionNotFound(String resourceType, int id, String version) {
        return ToolResponse.error("Error: Version '" + version + "' not found for " + resourceType + " " + id + ".");
    }
}
