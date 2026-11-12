package org.finos.calm.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.Response;
import org.finos.calm.config.PersonalNamespacesConfig;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.resources.CalmDocumentParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.function.Supplier;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestStarterArchitectureServiceShould {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Mock
    PersonalNamespacesConfig mockConfig;

    @Mock
    MappingControllerService mockMappingControllerService;

    @Mock
    CalmDocumentParser mockDocumentParser;

    @BeforeEach
    void setUp() throws Exception {
        when(mockConfig.starterArchitecture()).thenReturn(true);
        when(mockDocumentParser.normalizeBase()).thenReturn("https://hub.example.com");
        when(mockMappingControllerService.createOrAddVersion(anyString(), any(), anyString(), anyString(), any()))
                .thenReturn(Response.status(201).build());
    }

    private static Supplier<InputStream> versions(String text) {
        return () -> new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8));
    }

    private StarterArchitectureService service(Supplier<InputStream> schemaVersions) {
        return new StarterArchitectureService(mockConfig, mockMappingControllerService, mockDocumentParser, schemaVersions);
    }

    private JsonNode createAndCapture(String namespace, String principal) throws Exception {
        service(versions("1.0\n1.3\n1.2\n")).create(namespace, principal);
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mockMappingControllerService).createOrAddVersion(eq(namespace), eq(ResourceType.ARCHITECTURE),
                eq("my-architecture"), body.capture(), eq(new CalmDocumentParser.VersionSpec("1.0.0", true)));
        return MAPPER.readTree(body.getValue());
    }

    @Test
    void write_my_architecture_with_the_latest_bundled_schema_and_its_canonical_id() throws Exception {
        JsonNode doc = createAndCapture("users.mark-scott", "mark.scott");

        assertThat(doc.get("$schema").asText(), is("https://calm.finos.org/release/1.3/meta/calm.json"));
        assertThat(doc.get("$id").asText(),
                is("https://hub.example.com/calm/namespaces/users.mark-scott/architectures/my-architecture/versions/1.0.0"));
        assertThat(doc.get("title").asText(), is("My architecture"));
    }

    @Test
    void name_the_actor_after_the_principal_with_a_safe_unique_id() throws Exception {
        JsonNode doc = createAndCapture("users.Mark-Scott-example-com", "Mark.Scott@example.com");

        JsonNode actor = doc.get("nodes").get(0);
        assertThat(actor.get("unique-id").asText(), is("user-mark-scott-example-com"));
        assertThat(actor.get("node-type").asText(), is("actor"));
        assertThat(actor.get("name").asText(), is("Mark.Scott@example.com"));
    }

    @Test
    void link_the_actor_to_the_cli_and_the_ui_and_both_to_the_api() throws Exception {
        JsonNode doc = createAndCapture("users.alice", "alice");

        assertThat(doc.get("nodes").findValuesAsText("unique-id"),
                contains("user-alice", "calm-cli", "calm-hub-ui", "calm-hub-api"));
        assertThat(doc.get("nodes").get(2).get("node-type").asText(), is("webclient"));

        JsonNode rels = doc.get("relationships");
        assertThat(rels.get(0).at("/relationship-type/interacts/actor").asText(), is("user-alice"));
        assertThat(rels.get(0).at("/relationship-type/interacts/nodes/0").asText(), is("calm-cli"));
        assertThat(rels.get(1).at("/relationship-type/interacts/nodes/0").asText(), is("calm-hub-ui"));
        assertThat(rels.get(2).at("/relationship-type/connects/source/node").asText(), is("calm-cli"));
        assertThat(rels.get(2).at("/relationship-type/connects/destination/node").asText(), is("calm-hub-api"));
        assertThat(rels.get(3).at("/relationship-type/connects/source/node").asText(), is("calm-hub-ui"));
        assertThat(rels.get(3).get("protocol").asText(), is("HTTPS"));
    }

    @Test
    void describe_the_five_starter_flows() throws Exception {
        JsonNode flows = createAndCapture("users.alice", "alice").get("flows");

        assertThat(flows.findValuesAsText("unique-id"), contains(
                "flow-create-namespace-cli", "flow-create-namespace-ui", "flow-pull-architecture",
                "flow-push-architecture", "flow-browse-architectures"));
        JsonNode cliCreate = flows.get(0).get("transitions");
        assertThat(cliCreate.findValuesAsText("relationship-unique-id"),
                contains("user-uses-cli", "cli-to-hub-api", "cli-to-hub-api"));
        assertThat(cliCreate.get(2).get("sequence-number").asInt(), is(3));
        assertThat(cliCreate.get(2).get("direction").asText(), is("destination-to-source"));
        assertThat(cliCreate.get(0).has("direction"), is(false));
        assertThat(flows.get(4).get("transitions").get(0).get("relationship-unique-id").asText(), is("user-uses-hub-ui"));
    }

    @Test
    void compare_schema_versions_as_numbers_and_skip_other_lines() throws Exception {
        Optional<String> latest = service(versions("1.9\n# comment\n1.10\n\n1.2\n")).latestSchemaVersion();

        assertThat(latest, is(Optional.of("1.10")));
    }

    @Test
    void read_the_bundled_schema_versions_from_the_classpath() throws Exception {
        StarterArchitectureService service = new StarterArchitectureService(mockConfig, mockMappingControllerService, mockDocumentParser);

        assertThat(service.latestSchemaVersion().isPresent(), is(true));
    }

    @Test
    void do_nothing_when_the_flag_is_off() {
        when(mockConfig.starterArchitecture()).thenReturn(false);

        service(versions("1.3")).create("users.alice", "alice");

        verifyNoInteractions(mockMappingControllerService);
    }

    @Test
    void do_nothing_when_no_schema_release_is_bundled() {
        service(() -> null).create("users.alice", "alice");

        verifyNoInteractions(mockMappingControllerService);
    }

    @Test
    void not_throw_when_the_write_is_refused() throws Exception {
        when(mockMappingControllerService.createOrAddVersion(anyString(), any(), anyString(), anyString(), any()))
                .thenReturn(Response.status(409).build());

        assertDoesNotThrow(() -> service(versions("1.3")).create("users.alice", "alice"));
    }

    @Test
    void not_throw_when_the_write_fails() throws Exception {
        when(mockMappingControllerService.createOrAddVersion(anyString(), any(), anyString(), anyString(), any()))
                .thenThrow(new RuntimeException("store down"));

        assertDoesNotThrow(() -> service(versions("1.3")).create("users.alice", "alice"));
    }
}
