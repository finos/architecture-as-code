package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.ToolManager;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.restassured.response.Response;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.extensions.ExtensionTestKeys;
import org.finos.calm.extensions.FixtureBackend;
import org.finos.calm.security.AuditService;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.net.URI;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.finos.calm.mcp.tools.McpTestClient.callTool;
import static org.finos.calm.mcp.tools.McpTestClient.find;
import static org.finos.calm.mcp.tools.McpTestClient.listTools;
import static org.finos.calm.mcp.tools.McpTestClient.text;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Extension commands as MCP tools, called over the streamable HTTP transport and the real proxy. */
@QuarkusTest
@TestProfile(TestExtensionToolsMcpShould.McpProfile.class)
class TestExtensionToolsMcpShould {

    private static FixtureBackend backend;

    @Inject
    ExtensionTools extensionTools;

    @Inject
    ToolManager toolManager;

    @InjectMock
    UserAccessStore mockUserAccessStore;

    @InjectMock
    AuditService mockAuditService;

    public static class McpProfile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.mcp.enabled", "true",
                    "calm.extensions.dir", "src/test/resources/extensions-test/mcp",
                    "calm.extensions.\"mcp-test\".backend-url", "http://localhost:" + FixtureBackend.freePort(),
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations", KEYS.publicKey().toString());
        }
    }

    @BeforeAll
    static void startBackend() {
        String url = ConfigProvider.getConfig().getValue("calm.extensions.\"mcp-test\".backend-url", String.class);
        backend = new FixtureBackend(URI.create(url).getPort());
    }

    @AfterAll
    static void stopBackend() {
        backend.close();
    }

    @BeforeEach
    void resetBackend() {
        backend.reset();
    }

    @Test
    @TestSecurity(user = "alice")
    void list_the_command_tools_sorted_with_their_schemas_and_hints() {
        JsonArray tools = listTools();
        List<String> names = tools.stream().map(t -> ((JsonObject) t).getString("name"))
                .filter(name -> name.startsWith("ext_")).toList();

        assertThat(names, is(List.of("ext_mcp-test_add-service", "ext_mcp-test_annotate", "ext_mcp-test_get-service", "ext_mcp-test_list-services",
                "ext_mcp-test_remove-service", "ext_mcp-test_search", "ext_mcp-test_service-names", "ext_mcp-test_slow-pattern")));
        JsonObject list = find(tools, "ext_mcp-test_list-services");
        assertThat(list.getString("description"), is("List the services that a namespace owns"));
        assertThat(list.getString("title"), is("MCP test: list-services"));
        assertThat(list.getJsonObject("inputSchema").getJsonArray("required"), is(new JsonArray().add("namespace")));
        assertThat(list.getJsonObject("outputSchema").getString("type"), is("object"));
        assertThat(list.getJsonObject("annotations").getBoolean("readOnlyHint"), is(true));
        JsonObject remove = find(tools, "ext_mcp-test_remove-service");
        assertThat(remove.getJsonObject("annotations").getBoolean("readOnlyHint"), is(false));
        assertThat(remove.getJsonObject("annotations").getBoolean("destructiveHint"), is(true));
        assertThat(remove.getJsonObject("outputSchema"), nullValue());
        JsonObject wrapped = find(tools, "ext_mcp-test_service-names").getJsonObject("outputSchema");
        assertThat(wrapped.getString("type"), is("object"));
        JsonObject result = wrapped.getJsonObject("properties").getJsonObject("result");
        assertThat(result.containsKey("$ref"), is(false));
        assertThat(result.getJsonArray("allOf"), is(new JsonArray().add(new JsonObject().put("$ref", "#/$defs/names"))));
    }

    // A page on another site can POST text/plain with no preflight, but it cannot read or send an Mcp-Session-Id.
    @Test
    @TestSecurity(user = "alice")
    void refuse_a_text_plain_tool_call_with_no_session() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.read, "finos")));
        backend.reply(FixtureBackend.Reply.json(200, "{\"services\":[\"payments\"]}"));
        JsonObject call = new JsonObject().put("jsonrpc", "2.0").put("id", 1).put("method", "tools/call")
                .put("params", new JsonObject().put("name", "ext_mcp-test_list-services")
                        .put("arguments", new JsonObject().put("namespace", "finos")));

        Response response = given().contentType("text/plain").accept("application/json, text/event-stream")
                .body(call.encode()).post("/mcp");

        assertThat(response.asString(), response.asString(), not(containsString("\"result\"")));
        assertThat(response.asString(), containsString("\"error\""));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void list_boolean_subschemas_as_objects() {
        JsonObject annotate = find(listTools(), "ext_mcp-test_annotate");

        JsonObject input = annotate.getJsonObject("inputSchema").getJsonObject("properties");
        assertThat(input.getJsonObject("note"), is(new JsonObject()));
        assertThat(input.getJsonObject("never"), is(new JsonObject().put("not", new JsonObject())));
        JsonObject output = annotate.getJsonObject("outputSchema").getJsonObject("properties");
        assertThat(output.getJsonObject("hits"), is(new JsonObject()));
        assertThat(output.getJsonObject("tags").getJsonObject("items"), is(new JsonObject()));
    }

    @Test
    @TestSecurity(user = "alice")
    void wrap_a_reply_that_is_not_an_object_in_result() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.read, "finos")));
        backend.reply(FixtureBackend.Reply.json(200, "[\"payments\"]"));

        JsonObject result = callTool("ext_mcp-test_service-names", new JsonObject().put("namespace", "finos"));

        assertThat(result.encode(), result.getBoolean("isError", false), is(false));
        assertThat(result.getJsonObject("structuredContent"), is(new JsonObject().put("result", new JsonArray().add("payments"))));
        assertThat(new JsonObject(text(result)), is(result.getJsonObject("structuredContent")));
    }

    @Test
    @TestSecurity(user = "alice")
    void call_the_route_through_the_proxy_with_the_callers_identity() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.read, "finos")));
        backend.reply(FixtureBackend.Reply.json(200, "{\"services\":[\"payments\"]}"));

        JsonObject result = callTool("ext_mcp-test_list-services", new JsonObject().put("namespace", "finos").put("limit", 2));

        assertThat(result.encode(), result.getBoolean("isError", false), is(false));
        assertThat(result.getJsonObject("structuredContent").getJsonArray("services"), is(new JsonArray().add("payments")));
        assertThat(new JsonObject(text(result)), is(result.getJsonObject("structuredContent")));
        FixtureBackend.Received received = backend.received();
        assertThat(received.method(), is("GET"));
        assertThat(received.pathAndQuery(), is("/namespaces/finos/services?limit=2"));
        assertThat(received.header("X-Calm-Hub-Identity"), notNullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void send_the_rest_of_the_input_as_the_body_of_a_write() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.write, "finos")));
        backend.reply(FixtureBackend.Reply.json(201, "{\"id\":\"payments\"}"));

        JsonObject result = callTool("ext_mcp-test_add-service", new JsonObject().put("namespace", "finos")
                .put("service", new JsonObject().put("name", "payments")));

        assertThat(result.encode(), result.getBoolean("isError", false), is(false));
        FixtureBackend.Received received = backend.received();
        assertThat(received.method(), is("POST"));
        assertThat(received.pathAndQuery(), is("/namespaces/finos/services"));
        assertThat(new JsonObject(received.body()), is(new JsonObject().put("service", new JsonObject().put("name", "payments"))));
    }

    @Test
    @TestSecurity(user = "bob")
    void check_the_scope_when_the_tool_is_called() {
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of());

        JsonObject result = callTool("ext_mcp-test_list-services", new JsonObject().put("namespace", "finos"));

        assertThat(result.getBoolean("isError"), is(true));
        assertThat(text(result), is("Error: You do not have the scope that this extension route needs"));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "bob")
    void check_the_scope_before_the_slow_pattern_of_the_input() {
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of());

        JsonObject result = callTool("ext_mcp-test_slow-pattern",
                new JsonObject().put("namespace", "finos").put("text", "a".repeat(60) + "!"));

        assertThat(text(result), is("Error: You do not have the scope that this extension route needs"));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void match_slow_patterns_in_linear_time() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.read, "finos")));

        JsonObject result = callTool("ext_mcp-test_slow-pattern", new JsonObject().put("namespace", "finos")
                .put("text", "a".repeat(100_000) + "!").put("empty", "a".repeat(100_000)).put("choice", "a".repeat(100_000)));

        assertThat(result.getBoolean("isError"), is(true));
        assertThat(text(result), containsString("/text: String does not match pattern"));
        assertThat(text(result), containsString("/empty: String does not match pattern"));
        assertThat(text(result), containsString("/choice: String does not match pattern"));
        assertThat(backend.received(), nullValue());
        backend.reply(FixtureBackend.Reply.json(200, "{}"));
        JsonObject next = callTool("ext_mcp-test_slow-pattern", new JsonObject().put("namespace", "finos").put("text", "a".repeat(12)));
        assertThat(next.encode(), next.getBoolean("isError", false), is(false));
    }

    @Test
    void refuse_an_anonymous_call() {
        JsonObject result = callTool("ext_mcp-test_search", new JsonObject().put("text", "pay"));

        assertThat(result.getBoolean("isError"), is(true));
        assertThat(text(result), is("Error: Sign in to call this extension"));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_input_that_does_not_match_the_schema() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.read, "finos")));

        JsonObject result = callTool("ext_mcp-test_list-services", new JsonObject().put("namespace", "finos").put("extra", 1));

        assertThat(result.getBoolean("isError"), is(true));
        assertThat(text(result), containsString("does not match the schema"));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void check_input_against_a_json_pointer_ref_with_an_ecma_262_pattern() {
        JsonObject refused = callTool("ext_mcp-test_search", new JsonObject().put("text", "pay").put("code", "ab-1"));

        assertThat(refused.getBoolean("isError"), is(true));
        assertThat(text(refused), containsString("/code"));
        assertThat(backend.received(), nullValue());

        backend.reply(FixtureBackend.Reply.json(200, "{}"));
        JsonObject accepted = callTool("ext_mcp-test_search", new JsonObject().put("text", "pay").put("code", "AB-1"));

        assertThat(accepted.encode(), accepted.getBoolean("isError", false), is(false));
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_encoded_and_dot_segment_parameter_values_as_the_rest_proxy_does() {
        for (String value : new String[]{"%61dmin", "%2e%2e", "%2F", "a/../b", "architectures/1", "..", "a..b", "a\\b",
                "alice@x", "50%", "a\u0000b", "a\tb", "a\u007fb", "a\u2215b", "a\uff3cb", "a\u2025b", "a\uff20b"}) {
            JsonObject result = callTool("ext_mcp-test_get-service", new JsonObject().put("service", value));

            assertThat(value, result.getBoolean("isError"), is(true));
            assertThat(value, text(result), containsString("Input property 'service' must not be empty or ., or contain"));
            given().urlEncodingEnabled(false)
                    .when().get("/api/calm/extensions/mcp-test/api/services/" + ExtensionTools.encodePathValue(value))
                    .then().statusCode(400).body("error", is("The extension path or query is not allowed"));
        }
        assertThat(backend.received(), nullValue());
        verifyNoInteractions(mockAuditService);
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_an_empty_parameter_value_that_rest_does_not_route() {
        JsonObject result = callTool("ext_mcp-test_get-service", new JsonObject().put("service", ""));

        assertThat(result.getBoolean("isError"), is(true));
        assertThat(text(result), containsString("Input property 'service' must not be empty or ., or contain"));
        given().when().get("/api/calm/extensions/mcp-test/api/services/")
                .then().statusCode(404);
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_a_parameter_value_that_matches_another_route_where_rest_checks_that_route() {
        JsonObject result = callTool("ext_mcp-test_get-service", new JsonObject().put("service", "admin"));

        assertThat(result.getBoolean("isError"), is(true));
        assertThat(text(result), is("Error: The input fills the path /services/{service} so that it matches route "
                + "'service-admin', not route 'service' of this command."));
        given().when().get("/api/calm/extensions/mcp-test/api/services/admin")
                .then().statusCode(403).body("error", is("You do not have the scope that this extension route needs"));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "bob")
    void audit_a_refused_write_with_the_denied_outcome() {
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of());

        JsonObject result = callTool("ext_mcp-test_remove-service", new JsonObject().put("namespace", "finos").put("name", "payments"));

        assertThat(result.getBoolean("isError"), is(true));
        ArgumentCaptor<AuditLogEntry> entry = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(mockAuditService).record(entry.capture());
        assertThat(entry.getValue().getOutcome(), is(AuditOutcome.DENIED));
        assertThat(entry.getValue().getRoute(), is("remove-service"));
        assertThat(entry.getValue().getActor(), is("bob"));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void audit_a_write_with_the_outcome_of_the_backend() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.write, "finos")));
        backend.reply(FixtureBackend.Reply.json(200, "{}"));

        JsonObject result = callTool("ext_mcp-test_remove-service", new JsonObject().put("namespace", "finos").put("name", "payments"));

        assertThat(result.encode(), result.getBoolean("isError", false), is(false));
        ArgumentCaptor<AuditLogEntry> entry = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(mockAuditService).record(entry.capture());
        assertThat(entry.getValue().getOutcome(), is(AuditOutcome.SUCCESS));
        assertThat(entry.getValue().getJti(), notNullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void not_list_the_tools_of_commands_whose_schemas_are_not_valid() {
        List<String> names = listTools().stream().map(t -> ((JsonObject) t).getString("name")).toList();

        assertThat(names.contains("ext_mcp-test_typo-input"), is(false));
        assertThat(names.contains("ext_mcp-test_typo-output"), is(false));
        assertThat(names.contains("ext_mcp-test_bad-keyword"), is(false));
        assertThat(names.contains("ext_mcp-test_dangling-input"), is(false));
        assertThat(names.contains("ext_mcp-test_dangling-output"), is(false));
        assertThat(names.contains("ext_mcp-test_ref-loop-output"), is(false));
        assertThat(names.contains("ext_mcp-test_java-pattern-input"), is(false));
        assertThat(names.contains("ext_mcp-test_java-pattern-output"), is(false));
        assertThat(names.contains("ext_mcp-test_draft-07"), is(false));
        assertThat(names.contains("ext_mcp-test_id-input"), is(false));
        assertThat(names.contains("ext_mcp-test_id-output"), is(false));
        assertThat(names.contains("ext_mcp-test_anchor-input"), is(false));
        assertThat(names.contains("ext_mcp-test_deep-pattern-input"), is(false));
        assertThat(names.contains("ext_mcp-test_deep-output"), is(false));
        assertThat(names.contains("ext_mcp-test_hidden-id-output"), is(false));
        assertThat(names.contains("ext_mcp-test_encoded-ref-output"), is(false));
    }

    @Test
    @TestSecurity(user = "alice")
    void remove_a_tool_that_quarkus_refuses_after_it_is_added() {
        ExtensionManifest.Route route = new ExtensionManifest.Route("search", "POST", "/search", "authenticated", true);
        ExtensionManifest.Command command = new ExtensionManifest.Command("search", "Typo",
                Map.of("type", "object", "properties", Map.of("limit", "integer")), null, null, null);

        extensionTools.register(List.of(new ExtensionTools.ExtensionTool("ext_mcp-test_refused", "mcp-test", "MCP test",
                "refused", command, route, null, List.of(route))));

        assertThat(toolManager.getTool("ext_mcp-test_refused"), nullValue());
        assertThat(listTools().stream().map(t -> ((JsonObject) t).getString("name")).toList()
                .contains("ext_mcp-test_refused"), is(false));
    }
}
