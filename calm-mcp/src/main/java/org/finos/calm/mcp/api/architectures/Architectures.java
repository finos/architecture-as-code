package org.finos.calm.mcp.api.architectures;

import io.quarkiverse.mcp.server.Tool;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class Architectures {

    private final Logger log = LoggerFactory.getLogger(Architectures.class);

    @RestClient
    ArchitecturesClient architecturesClient;

    @Tool(
            name = "getArchitectures",
            description = "Returns a list of architectures in CALM that live under a given namespace, " +
                    "where that namespace is given as an input."
    )
    public List<ArchitecturesInformation> getArchitectures(String namespace) {
        return architecturesClient.getArchitectures(namespace).getValues()
                .stream()
                .map(ArchitecturesInformation::new)
                .toList();
    }

    @Tool(
            name = "postNewArchitecture",
            description = "Create a brand new architecture defined using CALM under a given namespace."
    )
    public String postNewArchitecture(String architecture, String namespace) {
        try {
            architecturesClient.postNewArchitecture(namespace, architecture);
            return "Created a new architecture in the [%s] namespace".formatted(namespace);
        } catch (Exception e) {
            return "Architecture post failed with error: %s".formatted(e.getMessage());
        }
    }
}
