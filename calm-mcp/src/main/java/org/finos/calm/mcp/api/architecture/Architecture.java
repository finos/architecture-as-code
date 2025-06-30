package org.finos.calm.mcp.api.architecture;

import io.quarkiverse.mcp.server.Tool;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Architecture {

    private final Logger log = LoggerFactory.getLogger(Architecture.class);

    @RestClient
    ArchitectureClient architectureClient;

    @Tool(
            name = "getArchitecture",
            description = "Returns a specific architecture which is a CALM architecture document representing a software architecture. " +
                    "To request this resource, you need a namespace, the architecture ID and a specific version to load."
    )
    public ArchitectureInformation getArchitecture(String namespace, String architectureId, String version) {
        return new ArchitectureInformation(architectureClient.getArchitecture(namespace, architectureId, version));
    }
}
