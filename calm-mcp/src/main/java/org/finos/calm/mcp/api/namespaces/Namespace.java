package org.finos.calm.mcp.api.namespaces;

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
}
