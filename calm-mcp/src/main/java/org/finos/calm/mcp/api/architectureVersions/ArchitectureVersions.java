package org.finos.calm.mcp.api.architectureVersions;

import io.quarkiverse.mcp.server.Tool;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class ArchitectureVersions {

    private final Logger log = LoggerFactory.getLogger(ArchitectureVersions.class);

    @RestClient
    ArchitectureVersionsClient architectureVersionsClient;

    @Tool(
            name = "getArchitectureVersions",
            description = "Returns a list of versions of a CALM architecture which lives under a specific namespace. " +
                    "These are semantic versions, e.g. 1.0.0, or a later version could be 2.1.3. " +
                    "To make this request you need to provide a namespace and an architecture ID."
    )
    public List<VersionsInformation> getArchitectureVersions(String namespace, String architectureId) {
        return architectureVersionsClient.getArchitectureVersions(namespace, architectureId).getValues()
                .stream()
                .map(VersionsInformation::new)
                .toList();
    }
}
