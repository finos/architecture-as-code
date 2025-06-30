package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;

import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class Pattern {

    private final Logger log = LoggerFactory.getLogger(Pattern.class);

    @RestClient
    PatternClient patternClient;

    @Tool(
            name = "getPatterns",
            description = "Returns a list of Pattern identifiers for a specific namespace in CALM. Patterns provide reusable architectural solutions and design templates. Requires a namespace parameter to specify which namespace to retrieve patterns from."
    )
    public List<PatternInformation> getPatterns(@ToolArg(description = "Name of CALM namespace") String namespace) {
        if (namespace == null || namespace.trim().isEmpty()) {
            log.error("Namespace parameter is null or empty");
            throw new IllegalArgumentException("Namespace parameter is required");
        }
        
        log.info("Retrieving patterns for namespace: {}", namespace);
        return patternClient.getPatterns(namespace).getValues()
                .stream()
                .map(patternId -> new PatternInformation(namespace, patternId))
                .toList();
    }

    @Tool(
            name = "getPatternVersions", 
            description = "Returns a list of version identifiers for a specific pattern in CALM. This retrieves all available versions of a pattern. Requires namespace and patternId parameters."
    )
    public List<PatternVersionInformation> getPatternVersions(
            @ToolArg(description = "Name of CALM namespace") String namespace,
            @ToolArg(description = "Pattern ID to get versions for") String patternId) {
        if (namespace == null || namespace.trim().isEmpty()) {
            log.error("Namespace parameter is null or empty");
            throw new IllegalArgumentException("Namespace parameter is required");
        }
        if (patternId == null || patternId.trim().isEmpty()) {
            log.error("PatternId parameter is null or empty");
            throw new IllegalArgumentException("PatternId parameter is required");
        }
        
        try {
            int patId = Integer.parseInt(patternId);
            log.info("Retrieving versions for pattern {} in namespace: {}", patId, namespace);
            return patternClient.getPatternVersions(namespace, patId).getValues()
                    .stream()
                    .map(version -> new PatternVersionInformation(namespace, patId, version))
                    .toList();
        } catch (NumberFormatException e) {
            log.error("Invalid patternId format: {}", patternId);
            throw new IllegalArgumentException("PatternId must be a valid integer");
        }
    }

    @Tool(
            name = "getPattern",
            description = "Returns the complete pattern definition for a specific version. This retrieves the actual pattern JSON content. Requires namespace, patternId, and version parameters."
    )
    public PatternDetails getPattern(
            @ToolArg(description = "Name of CALM namespace") String namespace,
            @ToolArg(description = "Pattern ID") String patternId,
            @ToolArg(description = "Version of the pattern") String version) {
        if (namespace == null || namespace.trim().isEmpty()) {
            log.error("Namespace parameter is null or empty");
            throw new IllegalArgumentException("Namespace parameter is required");
        }
        if (patternId == null || patternId.trim().isEmpty()) {
            log.error("PatternId parameter is null or empty");
            throw new IllegalArgumentException("PatternId parameter is required");
        }
        if (version == null || version.trim().isEmpty()) {
            log.error("Version parameter is null or empty");
            throw new IllegalArgumentException("Version parameter is required");
        }
        
        try {
            int patId = Integer.parseInt(patternId);
            log.info("Retrieving pattern {} version {} in namespace: {}", patId, version, namespace);
            Object pattern = patternClient.getPattern(namespace, patId, version);
            return new PatternDetails(namespace, patId, version, pattern);
        } catch (NumberFormatException e) {
            log.error("Invalid patternId format: {}", patternId);
            throw new IllegalArgumentException("PatternId must be a valid integer");
        }
    }
}
