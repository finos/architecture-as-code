package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;

import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class Adr {

    private final Logger log = LoggerFactory.getLogger(Adr.class);

    @RestClient
    AdrClient adrClient;

    @Tool(
            name = "getAdrs",
            description = "Returns a list of ADR (Architecture Decision Record) identifiers for a specific namespace in CALM. ADRs document important architectural decisions, their context, and rationale. Requires a namespace parameter to specify which namespace to retrieve ADRs from."
    )
    public List<AdrInformation> getAdrs(@ToolArg(description = "Name of CALM namespace") String namespace) {
        if (namespace == null || namespace.trim().isEmpty()) {
            log.error("Namespace parameter is null or empty");
            throw new IllegalArgumentException("Namespace parameter is required");
        }
        
        log.info("Retrieving ADRs for namespace: {}", namespace);
        return adrClient.getAdrIds(namespace).getValues()
                .stream()
                .map(adrId -> new AdrInformation(namespace, Integer.parseInt(adrId)))
                .toList();
    }
}
