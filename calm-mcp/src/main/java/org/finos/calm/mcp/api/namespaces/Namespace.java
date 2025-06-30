package org.finos.calm.mcp.api.namespaces;

import io.quarkiverse.mcp.server.Prompt;
import io.quarkiverse.mcp.server.PromptMessage;
import io.quarkiverse.mcp.server.Tool;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class Namespace {

    private final Logger log = LoggerFactory.getLogger(Namespace.class);

    @RestClient
    NamespaceClient namespaceClient;

    @Tool(
            name = "getNamespaces",
            description = "Returns a list of namespace identifiers in CALM. Namespaces represent logical groups of " +
                    "architecture models, such as controls, patterns, or specifications tied " +
                    "to a specific team, function, or domain."
    )
    public List<NamespaceInformation> getNamespaces() {
        return namespaceClient.getNamespaces().getValues()
                .stream()
                .map(NamespaceInformation::new)
                .toList();
    }

    @Prompt(
            name = "getNamespaceDetails",
            description = "Retrieves detailed information about a specific namespace in CALM, including its identifier and description. This tool is useful for understanding the context and purpose of a namespace."
    )
    public PromptMessage getNamespaceDetails(String namespace) {
        if (namespace == null || namespace.trim().isEmpty()) {
            log.error("Namespace parameter is null or empty");
            throw new IllegalArgumentException("Namespace parameter is required"); 
        }
        log.info("Retrieving details for namespace: {}", namespace);
        PromptMessage response = PromptMessage.withAssistantRole(String.format("When asked about the namespace '%s', the system should respond with its identifier, description, architectures, flows, patterns, standards.", namespace));
        return response;
    }
}
