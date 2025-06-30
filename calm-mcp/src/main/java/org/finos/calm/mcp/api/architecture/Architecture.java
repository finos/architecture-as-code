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

    @Tool(
            name = "postArchitecture",
            description = "Post a new version of a CALM architecture under a given namespace and architecture ID. " +
                    "To make this post request, you need the namespace, architecture ID for the architecture you're posting to. " +
                    "You also need to specify a new semantic version. Finally you need to provide a string which is the " +
                    "CALM architecture document called 'architecture'."
    )
    public String postArchitecture(String architecture, String namespace, String architectureId, String version) {
        try {
            architectureClient.postArchitecture(namespace, architectureId, version, architecture);
        } catch (Exception e) {
            return "Architecture post failed with error: %s".formatted(e.getMessage());
        }
        return "A new version [%s] of architecture [%s] was created in the [%s] namespace".formatted(version, architectureId, namespace);
    }
}
