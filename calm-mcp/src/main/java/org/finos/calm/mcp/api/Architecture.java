package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;

import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class Architecture {

    private final Logger log = LoggerFactory.getLogger(Architecture.class);

    @RestClient
    ArchitectureClient architectureClient;

    @Tool(
            name = "getArchitectures",
            description = "Returns a list of Architecture identifiers for a specific namespace in CALM. Architectures define system designs, component relationships, and architectural decisions. Requires a namespace parameter to specify which namespace to retrieve architectures from."
    )
    public List<ArchitectureInformation> getArchitectures(@ToolArg(description = "Name of CALM namespace") String namespace) {
        if (namespace == null || namespace.trim().isEmpty()) {
            log.error("Namespace parameter is null or empty");
            throw new IllegalArgumentException("Namespace parameter is required");
        }
        
        log.info("Retrieving architectures for namespace: {}", namespace);
        return architectureClient.getArchitectures(namespace).getValues()
                .stream()
                .map(architectureId -> new ArchitectureInformation(namespace, architectureId))
                .toList();
    }

    @Tool(
            name = "getArchitectureVersions",
            description = "Returns a list of version identifiers for a specific architecture in CALM. This retrieves all available versions of an architecture. Requires namespace and architectureId parameters."
    )
    public List<ArchitectureVersionInformation> getArchitectureVersions(
            @ToolArg(description = "Name of CALM namespace") String namespace,
            @ToolArg(description = "Architecture ID to get versions for") String architectureId) {
        if (namespace == null || namespace.trim().isEmpty()) {
            log.error("Namespace parameter is null or empty");
            throw new IllegalArgumentException("Namespace parameter is required");
        }
        if (architectureId == null || architectureId.trim().isEmpty()) {
            log.error("ArchitectureId parameter is null or empty");
            throw new IllegalArgumentException("ArchitectureId parameter is required");
        }
        
        try {
            int archId = Integer.parseInt(architectureId);
            log.info("Retrieving versions for architecture {} in namespace: {}", archId, namespace);
            return architectureClient.getArchitectureVersions(namespace, archId).getValues()
                    .stream()
                    .map(version -> new ArchitectureVersionInformation(namespace, archId, version))
                    .toList();
        } catch (NumberFormatException e) {
            log.error("Invalid architectureId format: {}", architectureId);
            throw new IllegalArgumentException("ArchitectureId must be a valid integer");
        }
    }

    @Tool(
            name = "getArchitecture",
            description = "Returns the complete architecture definition for a specific version. This retrieves the actual architecture JSON content. Requires namespace, architectureId, and version parameters."
    )
    public ArchitectureDetails getArchitecture(
            @ToolArg(description = "Name of CALM namespace") String namespace,
            @ToolArg(description = "Architecture ID") String architectureId,
            @ToolArg(description = "Version of the architecture") String version) {
        if (namespace == null || namespace.trim().isEmpty()) {
            log.error("Namespace parameter is null or empty");
            throw new IllegalArgumentException("Namespace parameter is required");
        }
        if (architectureId == null || architectureId.trim().isEmpty()) {
            log.error("ArchitectureId parameter is null or empty");
            throw new IllegalArgumentException("ArchitectureId parameter is required");
        }
        if (version == null || version.trim().isEmpty()) {
            log.error("Version parameter is null or empty");
            throw new IllegalArgumentException("Version parameter is required");
        }
        
        try {
            int archId = Integer.parseInt(architectureId);
            log.info("Retrieving architecture {} version {} in namespace: {}", archId, version, namespace);
            Object architecture = architectureClient.getArchitecture(namespace, archId, version);
            return new ArchitectureDetails(namespace, archId, version, architecture);
        } catch (NumberFormatException e) {
            log.error("Invalid architectureId format: {}", architectureId);
            throw new IllegalArgumentException("ArchitectureId must be a valid integer");
        }
    }
}
