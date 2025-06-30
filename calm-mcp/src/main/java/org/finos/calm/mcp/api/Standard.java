package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;

import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class Standard {

    private final Logger log = LoggerFactory.getLogger(Standard.class);

    @RestClient
    StandardClient standardClient;

    @Tool(
            name = "getStandards",
            description = "Returns a list of Standard identifiers for a specific namespace in CALM. Standards define compliance requirements, governance controls, and regulatory frameworks. Requires a namespace parameter to specify which namespace to retrieve standards from."
    )
    public List<StandardInformation> getStandards(@ToolArg(description = "Name of CALM namespace") String namespace) {
        if (namespace == null || namespace.trim().isEmpty()) {
            log.error("Namespace parameter is null or empty");
            throw new IllegalArgumentException("Namespace parameter is required");
        }
        
        log.info("Retrieving standards for namespace: {}", namespace);
        return standardClient.getStandards(namespace).getValues()
                .stream()
                .map(standardId -> new StandardInformation(namespace, standardId))
                .toList();
    }
}
