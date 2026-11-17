package org.finos.calm.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;
import org.finos.calm.config.PersonalNamespacesConfig;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.resources.CalmDocumentParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Writes {@code my-architecture} into a new personal namespace, so the owner has a valid
 * CALM document to start from. See issue #3689.
 */
@ApplicationScoped
public class StarterArchitectureService {

    private static final Logger LOG = LoggerFactory.getLogger(StarterArchitectureService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    static final String NAME = "my-architecture";
    static final String VERSION = "1.0.0";
    static final String SCHEMA_VERSIONS = "META-INF/calm-schemas/versions.txt";

    private final PersonalNamespacesConfig config;
    private final MappingControllerService mappingControllerService;
    private final CalmDocumentParser documentParser;
    private final Supplier<InputStream> schemaVersions;

    @Inject
    public StarterArchitectureService(PersonalNamespacesConfig config,
                                      MappingControllerService mappingControllerService,
                                      CalmDocumentParser documentParser) {
        this(config, mappingControllerService, documentParser,
                () -> StarterArchitectureService.class.getClassLoader().getResourceAsStream(SCHEMA_VERSIONS));
    }

    StarterArchitectureService(PersonalNamespacesConfig config,
                               MappingControllerService mappingControllerService,
                               CalmDocumentParser documentParser,
                               Supplier<InputStream> schemaVersions) {
        this.config = config;
        this.mappingControllerService = mappingControllerService;
        this.documentParser = documentParser;
        this.schemaVersions = schemaVersions;
    }

    /**
     * Writes the starter architecture. A failure is logged and never thrown, because the
     * namespace is the main result of the request.
     */
    public void create(String namespace, String principal) {
        if (!config.starterArchitecture()) {
            return;
        }
        try {
            Optional<String> schemaVersion = latestSchemaVersion();
            if (schemaVersion.isEmpty()) {
                LOG.warn("No bundled CALM schema release found, so [{}] gets no starter architecture", namespace);
                return;
            }
            String document = document(namespace, principal, schemaVersion.get());
            Response response = mappingControllerService.createOrAddVersion(namespace, ResourceType.ARCHITECTURE, NAME,
                    document, new CalmDocumentParser.VersionSpec(VERSION, true));
            if (response.getStatus() != Response.Status.CREATED.getStatusCode()) {
                LOG.warn("Could not write the starter architecture in [{}]: status {}", namespace, response.getStatus());
            }
        } catch (Exception e) {
            LOG.warn("Could not write the starter architecture in [{}]", namespace, e);
        }
    }

    Optional<String> latestSchemaVersion() throws IOException {
        try (InputStream in = schemaVersions.get()) {
            if (in == null) {
                return Optional.empty();
            }
            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            return reader.lines()
                    .map(String::trim)
                    .filter(line -> line.matches("\\d+\\.\\d+"))
                    .max(Comparator.comparing(StarterArchitectureService::versionParts, Arrays::compare));
        }
    }

    private static int[] versionParts(String version) {
        return Arrays.stream(version.split("\\.")).mapToInt(Integer::parseInt).toArray();
    }

    String document(String namespace, String principal, String schemaVersion) {
        String actorId = "user-" + namespace.substring(namespace.lastIndexOf('.') + 1).toLowerCase();

        ObjectNode doc = MAPPER.createObjectNode();
        doc.put("$schema", "https://calm.finos.org/release/" + schemaVersion + "/meta/calm.json");
        doc.put("$id", documentParser.normalizeBase()
                + CalmDocumentParser.namedResourcePath(namespace, ResourceType.ARCHITECTURE, NAME, VERSION));
        doc.put("title", "My architecture");
        doc.put("description", "A starter architecture for " + principal + ". Change it, or replace it with your own.");

        ArrayNode nodes = doc.putArray("nodes");
        nodes.add(node(actorId, "actor", principal, "You, working with CALM"));
        nodes.add(node("calm-cli", "service", "CALM CLI", "Command-line tool to validate, generate and push CALM documents"));
        nodes.add(node("calm-hub-ui", "webclient", "CALM Hub UI", "Web interface to browse and view CALM documents"));
        nodes.add(node("calm-hub-api", "service", "CALM Hub API", "Stores and serves CALM documents"));

        ArrayNode relationships = doc.putArray("relationships");
        relationships.add(interacts("user-uses-cli", actorId, "calm-cli", "You use the CLI"));
        relationships.add(interacts("user-uses-hub-ui", actorId, "calm-hub-ui", "You use CALM Hub UI in a web browser"));
        relationships.add(connects("cli-to-hub-api", "calm-cli", "calm-hub-api", "The CLI pushes and pulls documents"));
        relationships.add(connects("hub-ui-to-hub-api", "calm-hub-ui", "calm-hub-api", "The UI reads documents"));

        ArrayNode flows = doc.putArray("flows");
        flows.add(flow("flow-create-namespace-cli", "Create my namespace with the CLI",
                "You create your personal namespace from the command line",
                step("user-uses-cli", "You run 'calm hub create my-namespace'"),
                step("cli-to-hub-api", "The CLI calls PUT /api/calm/me/namespace"),
                reply("cli-to-hub-api", "Hub returns the name of your new namespace")));
        flows.add(flow("flow-create-namespace-ui", "Create my namespace in CALM Hub UI",
                "You create your personal namespace from the CALM Hub home page",
                step("user-uses-hub-ui", "You click Create on the My namespace card"),
                step("hub-ui-to-hub-api", "The UI calls PUT /api/calm/me/namespace"),
                reply("hub-ui-to-hub-api", "Hub returns your namespace, and the card shows Open")));
        flows.add(flow("flow-pull-architecture", "Pull an architecture with the CLI",
                "You get a copy of an architecture to change locally",
                step("user-uses-cli", "You run 'calm hub pull architecture'"),
                step("cli-to-hub-api", "The CLI requests the architecture version"),
                reply("cli-to-hub-api", "Hub returns the document, and the CLI writes it to a file")));
        flows.add(flow("flow-push-architecture", "Push an architecture with the CLI",
                "You publish your local changes as a new version",
                step("user-uses-cli", "You run 'calm hub push architecture'"),
                step("cli-to-hub-api", "The CLI sends the document. Hub stores it as a new version"),
                reply("cli-to-hub-api", "Hub returns the location of the new version")));
        flows.add(flow("flow-browse-architectures", "Browse architectures in CALM Hub UI",
                "You look at the architectures in a namespace",
                step("user-uses-hub-ui", "You open a namespace in CALM Hub UI"),
                step("hub-ui-to-hub-api", "The UI requests the architectures and their documents"),
                reply("hub-ui-to-hub-api", "Hub returns them, and the UI shows the diagram")));
        return doc.toString();
    }

    private record Step(String relationship, String description, boolean reply) {
    }

    private static Step step(String relationship, String description) {
        return new Step(relationship, description, false);
    }

    private static Step reply(String relationship, String description) {
        return new Step(relationship, description, true);
    }

    private static ObjectNode flow(String id, String name, String description, Step... steps) {
        ObjectNode flow = MAPPER.createObjectNode();
        flow.put("unique-id", id);
        flow.put("name", name);
        flow.put("description", description);
        ArrayNode transitions = flow.putArray("transitions");
        for (int i = 0; i < steps.length; i++) {
            ObjectNode transition = transitions.addObject();
            transition.put("relationship-unique-id", steps[i].relationship());
            transition.put("sequence-number", i + 1);
            transition.put("description", steps[i].description());
            if (steps[i].reply()) {
                transition.put("direction", "destination-to-source");
            }
        }
        return flow;
    }

    private static ObjectNode node(String id, String type, String name, String description) {
        ObjectNode node = MAPPER.createObjectNode();
        node.put("unique-id", id);
        node.put("node-type", type);
        node.put("name", name);
        node.put("description", description);
        return node;
    }

    private static ObjectNode interacts(String id, String actor, String target, String description) {
        ObjectNode rel = MAPPER.createObjectNode();
        rel.put("unique-id", id);
        rel.put("description", description);
        ObjectNode interacts = rel.putObject("relationship-type").putObject("interacts");
        interacts.put("actor", actor);
        interacts.putArray("nodes").add(target);
        return rel;
    }

    private static ObjectNode connects(String id, String source, String destination, String description) {
        ObjectNode rel = MAPPER.createObjectNode();
        rel.put("unique-id", id);
        rel.put("description", description);
        ObjectNode connects = rel.putObject("relationship-type").putObject("connects");
        connects.putObject("source").put("node", source);
        connects.putObject("destination").put("node", destination);
        rel.put("protocol", "HTTPS");
        return rel;
    }
}
