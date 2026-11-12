package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.ToolManager;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.vertx.http.runtime.CurrentVertxRequest;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.extensions.ExtensionManifestLoader;
import org.finos.calm.extensions.ExtensionPaths;
import org.finos.calm.extensions.ExtensionProxyException;
import org.finos.calm.extensions.ExtensionProxyRequest;
import org.finos.calm.extensions.ExtensionProxyResponse;
import org.finos.calm.extensions.ExtensionProxyService;
import org.finos.calm.extensions.ExtensionRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Answers;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.UnaryOperator;
import java.util.stream.Stream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestExtensionToolsShould {

    private static final List<ExtensionManifest> MANIFESTS =
            new ExtensionManifestLoader().loadDirectory(Path.of("src/test/resources/extensions-test/mcp"));
    private static final List<ExtensionTools.ExtensionTool> TOOLS = ExtensionTools.tools(MANIFESTS);

    @Mock(answer = Answers.RETURNS_SELF)
    ToolManager.ToolDefinition definition;

    @Mock
    ToolManager toolManager;

    @Mock
    ExtensionRegistry registry;

    @Mock
    ExtensionProxyService proxyService;

    @Mock
    SecurityIdentity identity;

    @InjectMocks
    ExtensionTools extensionTools;

    @BeforeEach
    void setup() {
        extensionTools.mcpEnabled = true;
    }

    private static final String PATH_RULE = "must not be empty or ., or contain .., /, \\, %, @, a look-alike of /, \\, ., %, "
            + "@ or ;, a control character or a lone surrogate";
    private static final String LINE_TOO_LONG = "The path and query are too long: the request line of the same REST call "
            + "would be longer than 4096 characters.";
    private static final JsonObject PATH_VALUES = pathValues();

    private static JsonObject pathValues() {
        try {
            return new JsonObject(Files.readString(Path.of("src/test/resources/extensions-test/path-values.json")));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static Stream<String> refusedPathValues() {
        return Stream.concat(PATH_VALUES.getJsonArray("refused").stream().map(String.class::cast),
                PATH_VALUES.getJsonArray("lookAlikes").stream().map(c -> "a" + c + "b"));
    }

    static Stream<JsonObject> encodedValues() {
        return PATH_VALUES.getJsonArray("encoded").stream().map(JsonObject.class::cast);
    }

    static Stream<String> otherRouteRefusedValues() {
        return PATH_VALUES.getJsonObject("otherRoute").getJsonArray("refused").stream().map(String.class::cast);
    }

    static Stream<String> otherRouteAcceptedValues() {
        return PATH_VALUES.getJsonObject("otherRoute").getJsonArray("accepted").stream().map(String.class::cast);
    }

    // The tool of the "route" of otherRoute, in an extension with the routes of otherRoute.
    private static ExtensionTools.ExtensionTool otherRouteTool() {
        JsonObject otherRoute = PATH_VALUES.getJsonObject("otherRoute");
        List<ExtensionManifest.Route> routes = otherRoute.getJsonArray("routes").stream().map(JsonObject.class::cast)
                .map(r -> new ExtensionManifest.Route(r.getString("id"), r.getString("method"), r.getString("path"), "authenticated", false))
                .toList();
        Map<String, ExtensionManifest.Command> commands = new LinkedHashMap<>();
        routes.forEach(r -> commands.put(r.id(), new ExtensionManifest.Command(r.id(), "C", Map.of("type", "object"), null, null, null)));
        ExtensionManifest manifest = new ExtensionManifest("x", "1.0.0", 0, "X", "X", "X", routes, commands, null);
        return ExtensionTools.tools(List.of(manifest)).stream()
                .filter(t -> t.route().id().equals(otherRoute.getString("route"))).findFirst().orElseThrow();
    }

    static Stream<String> acceptedPathValues() {
        return PATH_VALUES.getJsonArray("accepted").stream().map(String.class::cast);
    }

    // A client such as curl can encode !*'(), which encodeURIComponent and MCP leave as they are.
    private static String strictlyEncoded(String value) {
        return ExtensionTools.encodePathValue(value).replace("!", "%21").replace("*", "%2A").replace("'", "%27")
                .replace("(", "%28").replace(")", "%29");
    }

    private static String text(ToolResponse r) {
        return r.firstContent().asText().text();
    }

    private static ExtensionTools.ExtensionTool tool(String command) {
        return TOOLS.stream()
                .filter(t -> t.commandName().equals(command))
                .findFirst().orElseThrow();
    }

    private static String body(ExtensionProxyRequest request) throws IOException {
        return new String(request.body().readAllBytes(), StandardCharsets.UTF_8);
    }

    private static ExtensionProxyResponse reply(int status, String body) {
        return new ExtensionProxyResponse(status, Map.of("Content-Type", "application/json"), body.getBytes(StandardCharsets.UTF_8));
    }

    // --- registration ---

    @Test
    void name_the_tools_after_the_extension_and_command_sorted_by_name() {
        assertThat(TOOLS.stream().map(ExtensionTools.ExtensionTool::name).toList(),
                contains("ext_mcp-test_add-service", "ext_mcp-test_annotate", "ext_mcp-test_get-service", "ext_mcp-test_list-services", "ext_mcp-test_remove-service",
                        "ext_mcp-test_search", "ext_mcp-test_service-names", "ext_mcp-test_slow-pattern"));
    }

    @Test
    void sort_the_tools_of_all_extensions_together() {
        ExtensionManifest.Route route = new ExtensionManifest.Route("r", "GET", "/r", "authenticated", false);
        Map<String, Object> input = Map.of("type", "object");
        ExtensionManifest zeta = new ExtensionManifest("zeta", "1.0.0", 0, "Z", "Z", "Z", List.of(route),
                Map.of("a", new ExtensionManifest.Command("r", "A", input, null, null, null)), null);
        ExtensionManifest alpha = new ExtensionManifest("alpha", "1.0.0", 0, "A", "A", "A", List.of(route),
                Map.of("z", new ExtensionManifest.Command("r", "Z", input, null, null, null)), null);

        assertThat(ExtensionTools.tools(List.of(zeta, alpha)).stream().map(ExtensionTools.ExtensionTool::name).toList(),
                contains("ext_alpha_z", "ext_zeta_a"));
    }

    @Test
    void register_each_tool_with_its_schemas_and_hints() {
        when(registry.available()).thenReturn(MANIFESTS);
        when(toolManager.newTool(anyString())).thenReturn(definition);

        extensionTools.register();

        ArgumentCaptor<String> names = ArgumentCaptor.forClass(String.class);
        verify(toolManager, times(8)).newTool(names.capture());
        assertThat(names.getAllValues().getFirst(), is("ext_mcp-test_add-service"));
        verify(definition).setDescription("List the services that a namespace owns");
        verify(definition).setTitle("MCP test: list-services");
        verify(definition).setInputSchema(tool("list-services").command().input());
        verify(definition).setOutputSchema(tool("list-services").command().output());
        verify(definition).setOutputSchema(tool("service-names").outputSchema());
        verify(definition, times(8)).register();
    }

    @Test
    void publish_an_object_output_schema_as_it_is() {
        assertThat(tool("list-services").wrapsOutput(), is(false));
        assertThat(tool("list-services").outputSchema(), is(tool("list-services").command().output()));
    }

    @Test
    void wrap_an_output_schema_that_is_not_an_object_in_result() {
        Map<String, Object> schema = tool("service-names").outputSchema();

        assertThat(tool("service-names").wrapsOutput(), is(true));
        assertThat(schema.get("type"), is("object"));
        assertThat(schema.get("required"), is(List.of("result")));
        Map<?, ?> result = (Map<?, ?>) ((Map<?, ?>) schema.get("properties")).get("result");
        assertThat(result.get("$id"), is("https://calm.finos.org/calm-hub/extensions/mcp-test/commands/service-names/output.json"));
        assertThat(result.get("allOf"), is(List.of(Map.of("$ref", "#/$defs/names"))));
        assertThat(result.containsKey("$ref"), is(false));
        assertThat(((Map<?, ?>) result.get("$defs")).keySet(), contains("names", "name"));
    }

    @Test
    void keep_the_all_of_of_a_wrapped_output_schema_with_a_ref() {
        ExtensionManifest.Route route = new ExtensionManifest.Route("r", "GET", "/r", "authenticated", false);
        Map<String, Object> output = Map.of("$ref", "#/$defs/n", "allOf", List.of(Map.of("minItems", 1)),
                "$defs", Map.of("n", Map.of("type", "array")));
        ExtensionManifest manifest = new ExtensionManifest("x", "1.0.0", 0, "X", "X", "X", List.of(route),
                Map.of("c", new ExtensionManifest.Command("r", "C", Map.of("type", "object"), output, null, null)), null);

        Map<?, ?> result = (Map<?, ?>) ((Map<?, ?>) ExtensionTools.tools(List.of(manifest)).getFirst().outputSchema()
                .get("properties")).get("result");

        assertThat(result.get("allOf"), is(List.of(Map.of("minItems", 1), Map.of("$ref", "#/$defs/n"))));
        assertThat(result.containsKey("$ref"), is(false));
    }

    @Test
    void move_the_schema_dialect_to_the_wrapper() {
        ExtensionManifest.Route route = new ExtensionManifest.Route("r", "GET", "/r", "authenticated", false);
        Map<String, Object> output = Map.of("$schema", "https://json-schema.org/draft/2020-12/schema", "type", "string");
        ExtensionManifest manifest = new ExtensionManifest("x", "1.0.0", 0, "X", "X", "X", List.of(route),
                Map.of("c", new ExtensionManifest.Command("r", "C", Map.of("type", "object"), output, null, null)), null);

        Map<String, Object> schema = ExtensionTools.tools(List.of(manifest)).getFirst().outputSchema();

        assertThat(schema.get("$schema"), is("https://json-schema.org/draft/2020-12/schema"));
        assertThat(((Map<?, ?>) schema.get("properties")).get("result"), is(Map.of("type", "string",
                "$id", "https://calm.finos.org/calm-hub/extensions/x/commands/c/output.json")));
    }

    @Test
    void skip_a_command_whose_input_or_output_schema_has_a_remote_ref() {
        assertThat(TOOLS.stream().noneMatch(t -> t.commandName().startsWith("remote-")), is(true));
    }

    @Test
    void skip_a_command_whose_input_or_output_schema_is_not_valid_json_schema() {
        assertThat(TOOLS.stream().noneMatch(t -> t.commandName().startsWith("typo-") || t.commandName().equals("bad-keyword")),
                is(true));
    }

    @Test
    void accept_a_valid_schema() {
        assertThat(ExtensionTools.schemaError(Map.of("type", "object",
                "properties", Map.of("a", true, "b", Map.of("type", "integer", "minimum", 1)),
                "dependencies", Map.of("a", List.of("b")),
                "$defs", Map.of("d", Map.of("type", "string")))), nullValue());
    }

    @Test
    void name_a_property_schema_that_is_not_an_object_or_a_boolean() {
        assertThat(ExtensionTools.schemaError(Map.of("type", "object", "properties", Map.of("limit", "integer"))),
                is("/properties/limit: the value must be a schema (an object or a boolean)"));
        assertThat(ExtensionTools.schemaError(Map.of("items", Map.of("properties", Map.of("a/b", 1)))),
                is("/items/properties/a~1b: the value must be a schema (an object or a boolean)"));
        assertThat(ExtensionTools.schemaError(Map.of("allOf", List.of(Map.of(), "x"))),
                is("/allOf/1: the value must be a schema (an object or a boolean)"));
    }

    @Test
    void check_a_schema_against_the_meta_schema() {
        assertThat(ExtensionTools.schemaError(Map.of("type", "objekt")), startsWith("/type: "));
        assertThat(ExtensionTools.schemaError(Map.of("properties", Map.of("n", Map.of("minimum", "1")))),
                startsWith("/properties/n/minimum: "));
        assertThat(ExtensionTools.schemaError(Map.of("required", "name")), startsWith("/required: "));
    }

    @Test
    void skip_a_command_whose_schema_has_a_dangling_ref_a_java_only_pattern_or_another_dialect() {
        List<String> names = TOOLS.stream().map(ExtensionTools.ExtensionTool::commandName).toList();

        assertThat(names.stream().noneMatch(n -> n.startsWith("dangling-") || n.equals("ref-loop-output") || n.startsWith("java-pattern-")
                || n.equals("draft-07") || n.startsWith("id-") || n.equals("anchor-input") || n.equals("deep-pattern-input")),
                is(true));
        assertThat(names.contains("search"), is(true));
    }

    @Test
    void name_a_pattern_that_is_not_ecma_262() {
        assertThat(ExtensionTools.schemaError(Map.of("properties", Map.of("a", Map.of("type", "string", "pattern", "(?i)abc")))),
                startsWith("/properties/a/pattern: '(?i)abc' is not an ECMA-262 regular expression: "));
        assertThat(ExtensionTools.schemaError(Map.of("items", Map.of("patternProperties", Map.of("\\Aa", Map.of())))),
                startsWith("/items/patternProperties: the key '\\Aa' is not an ECMA-262 regular expression: "));
        // Valid in ECMA-262, but not in Java, which checks the schemas and the arguments.
        assertThat(ExtensionTools.schemaError(Map.of("pattern", "(?<first_name>a)")), startsWith("/pattern: "));
        assertThat(ExtensionTools.schemaError(Map.of("pattern", "\\u{5A}")), startsWith("/pattern: "));
        assertThat(ExtensionTools.schemaError(Map.of("pattern", "(".repeat(65) + ")".repeat(65))),
                startsWith("/pattern: '((((("));
        assertThat(ExtensionTools.schemaError(Map.of("pattern", "a".repeat(1001))),
                is("/pattern: '" + "a".repeat(60) + "...' is not an ECMA-262 regular expression: it is longer than 1000 characters"));
        assertThat(ExtensionTools.schemaError(Map.of("pattern", "^(?<a>[a-z]+)\\d{2,}$",
                "patternProperties", Map.of("^x-", Map.of()))), nullValue());
    }

    @Test
    void refuse_a_schema_of_another_dialect() {
        assertThat(ExtensionTools.schemaError(Map.of("$schema", "http://json-schema.org/draft-07/schema#", "type", "object")),
                is("/: it declares the $schema 'http://json-schema.org/draft-07/schema#', but CALM Hub supports only "
                        + "JSON Schema 2020-12 (https://json-schema.org/draft/2020-12/schema)"));
        assertThat(ExtensionTools.schemaError(Map.of("$defs", Map.of("d", Map.of(
                "$schema", "https://json-schema.org/draft/2019-09/schema")))), startsWith("/$defs/d: it declares the $schema "));
        assertThat(ExtensionTools.schemaError(Map.of("$schema", "https://json-schema.org/draft/2020-12/schema")), nullValue());
        assertThat(ExtensionTools.schemaError(Map.of("$schema", "https://json-schema.org/draft/2020-12/schema#")), nullValue());
    }

    @Test
    void refuse_every_schema_when_the_meta_schemas_cannot_be_loaded() {
        assertThat(ExtensionTools.META_SCHEMAS, notNullValue());
        assertThat(ExtensionTools.metaSchemas("no-such-folder/"), nullValue());
        assertThat(ExtensionTools.schemaError(Map.of("type", "object"), null),
                is("CALM Hub cannot load the JSON Schema 2020-12 meta-schema"));
    }

    @Test
    void register_no_tools_when_the_meta_schemas_cannot_be_loaded() {
        extensionTools.metaSchemas = null;

        extensionTools.register();

        verifyNoInteractions(toolManager, registry);
    }

    @Test
    void refuse_schema_identifiers() {
        for (String keyword : List.of("$id", "$anchor", "$dynamicAnchor", "$dynamicRef", "$recursiveAnchor", "$recursiveRef")) {
            assertThat(ExtensionTools.schemaError(Map.of(keyword, "#a")), is("/" + keyword + ": CALM Hub does not support "
                    + keyword + " in command schemas, at any depth or under any keyword. Use a $ref with a JSON Pointer, "
                    + "such as #/$defs/name"));
        }
        assertThat(ExtensionTools.schemaError(Map.of("$defs", Map.of("a", Map.of("$id", "urn:example:a")))),
                startsWith("/$defs/a/$id: "));
        assertThat(ExtensionTools.schemaError(Map.of("items", List.of(Map.of(), Map.of("$anchor", "a")))),
                startsWith("/items/1/$anchor: "));
    }

    // Ajv in the SDK collects ids also under unknown keywords, and reads $defs.$id as an id.
    @Test
    @SuppressWarnings("unchecked")
    void refuse_schema_identifiers_under_any_keyword() {
        Map<String, Object> id = Map.of("$id", "urn:x:y");
        Map<String, Object> cases = Map.of(
                "/x-a/$id", Map.of("type", "object", "x-a", id),
                "/x-a/b/0/$dynamicAnchor", Map.of("x-a", Map.of("b", List.of(Map.of("$dynamicAnchor", "d")))),
                "/default/$id", Map.of("default", id),
                "/examples/0/$anchor", Map.of("examples", List.of(Map.of("$anchor", "a"))),
                "/const/$recursiveRef", Map.of("const", Map.of("$recursiveRef", "#")),
                "/enum/0/$id", Map.of("enum", List.of(id)),
                "/properties/$id", Map.of("properties", Map.of("$id", Map.of("type", "string"))),
                "/$defs/$id", Map.of("$defs", Map.of("$id", Map.of())));
        cases.forEach((pointer, schema) -> assertThat(pointer, ExtensionTools.schemaError((Map<String, Object>) schema),
                startsWith(pointer + ": CALM Hub does not support ")));
    }

    @Test
    void accept_refs_and_identifier_values_where_they_are_data() {
        assertThat(ExtensionTools.schemaError(Map.of("type", "object",
                "x-example", Map.of("$ref", "https://example.com/a.json", "name", "$id"),
                "enum", List.of("$id", "$anchor"),
                "examples", List.of(Map.of("$ref", "https://example.com/c.json")))), nullValue());
        assertThat(tool("annotate"), notNullValue());
    }

    @Test
    @SuppressWarnings("unchecked")
    void refuse_a_schema_nested_deeper_than_the_limit() {
        Object deep = Map.of("type", "string");
        for (int i = 1; i < ExtensionTools.MAX_SCHEMA_DEPTH; i++) {
            deep = Map.of("items", deep);
        }
        assertThat(ExtensionTools.schemaError((Map<String, Object>) deep), nullValue());
        assertThat(ExtensionTools.schemaError(Map.of("items", deep)), containsString("nested more than 64 objects and arrays deep"));

        // Each property map, list and unknown keyword value counts.
        Object data = "x";
        for (int i = 0; i < 32; i++) {
            data = List.of(Map.of("a", data));
        }
        assertThat(ExtensionTools.schemaError(Map.of("x-data", data)), containsString("nested more than 64"));
        assertThat(ExtensionTools.schemaError(nestedProperties(31)), nullValue());
        assertThat(ExtensionTools.schemaError(nestedProperties(32)), containsString("nested more than 64"));
    }

    @Test
    void count_each_ref_hop_in_the_depth_limit() {
        // Each hop adds 3 levels: properties, a and the target.
        assertThat(ExtensionTools.schemaError(refChain(20, next -> Map.of("properties", Map.of("a", next)))), nullValue());
        assertThat(ExtensionTools.schemaError(refChain(21, next -> Map.of("properties", Map.of("a", next)))),
                is("/$defs/d20/properties: the schema is nested more than 64 objects and arrays deep when its $refs are "
                        + "followed, which CALM Hub does not support"));
        for (UnaryOperator<Map<String, Object>> shape : List.<UnaryOperator<Map<String, Object>>>of(
                next -> Map.of("type", "object", "properties", Map.of("a", next)),
                next -> Map.of("items", next),
                next -> Map.of("not", next),
                next -> next)) {
            assertThat(ExtensionTools.schemaError(refChain(250, shape)), containsString("when its $refs are followed"));
        }
        // A recursive schema adds no depth for each loop.
        assertThat(ExtensionTools.schemaError(Map.of("$ref", "#/$defs/node", "$defs", Map.of("node", Map.of("type", "object",
                "properties", Map.of("children", Map.of("type", "array", "items", Map.of("$ref", "#/$defs/node"))))))),
                nullValue());
    }

    // A root whose property a refs d0, each di holding a ref to d(i+1) in the given shape, and d(hops) a string.
    private static Map<String, Object> refChain(int hops, UnaryOperator<Map<String, Object>> shape) {
        Map<String, Object> defs = new LinkedHashMap<>();
        for (int i = 0; i < hops; i++) {
            defs.put("d" + i, shape.apply(Map.of("$ref", "#/$defs/d" + (i + 1))));
        }
        defs.put("d" + hops, Map.of("type", "string"));
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("type", "object");
        root.put("properties", Map.of("a", Map.of("$ref", "#/$defs/d0")));
        root.put("$defs", defs);
        return root;
    }

    private static Map<String, Object> nestedProperties(int levels) {
        Map<String, Object> schema = Map.of("type", "string");
        for (int i = 0; i < levels; i++) {
            schema = Map.of("properties", Map.of("p", schema));
        }
        return schema;
    }

    @Test
    void refuse_a_ref_with_a_percent_sign() {
        Map<String, Object> defs = Map.of("a", Map.of("not", Map.of()), "a/not", Map.of(), "s p", Map.of(), "�", Map.of());
        for (String ref : List.of("#/$defs/a%2Fnot", "#%2F$defs/a", "#/$defs/s%20p", "#/$defs/%E0", "#/$defs/%C0%AF")) {
            assertThat(ref, ExtensionTools.schemaError(Map.of("properties", Map.of("p", Map.of("$ref", ref)), "$defs", defs)),
                    is("/properties/p/$ref: '" + ref + "' has a %, which CALM Hub does not support in a $ref. "
                            + "Use $defs names that need no percent-encoding"));
        }
    }

    @Test
    void rethrow_virtual_machine_errors_other_than_a_stack_overflow() {
        ExtensionTools.rethrowIfFatal(new StackOverflowError());
        ExtensionTools.rethrowIfFatal(new LinkageError());
        ExtensionTools.rethrowIfFatal(new IllegalStateException());
        assertThrows(OutOfMemoryError.class, () -> ExtensionTools.rethrowIfFatal(new OutOfMemoryError()));
        assertThrows(InternalError.class, () -> ExtensionTools.rethrowIfFatal(new InternalError()));
    }

    @Test
    void fail_on_an_out_of_memory_error_in_a_schema_check() {
        ExtensionManifest.Route route = new ExtensionManifest.Route("r", "GET", "/r", "authenticated", false);
        Map<String, Object> failing = new HashMap<>(Map.of("type", "object")) {
            @Override
            public Object get(Object key) {
                throw new OutOfMemoryError();
            }
        };
        ExtensionManifest manifest = new ExtensionManifest("bad", "1.0.0", 0, "B", "B", "B", List.of(route),
                Map.of("c", new ExtensionManifest.Command("r", "C", failing, null, null, null)), null);

        assertThrows(OutOfMemoryError.class, () -> ExtensionTools.tools(List.of(manifest)));
    }

    @Test
    void fail_on_an_out_of_memory_error_in_a_registration() {
        when(toolManager.newTool(anyString())).thenReturn(definition);
        when(definition.register()).thenThrow(new ClassCastException("not a JsonObject"));
        when(toolManager.removeTool(anyString())).thenThrow(new OutOfMemoryError());

        assertThrows(OutOfMemoryError.class, () -> extensionTools.register(List.of(tool("search"), tool("annotate"))));

        doThrow(new OutOfMemoryError()).when(definition).register();
        assertThrows(OutOfMemoryError.class, () -> extensionTools.register(List.of(tool("search"))));
    }

    @Test
    void accept_local_json_pointer_refs() {
        Map<String, Object> defs = Map.of("a", Map.of("type", "string"), "b", true,
                "l", Map.of("anyOf", List.of(Map.of(), true)), "e~/x", Map.of(), "s p", Map.of());
        Map<String, Object> node = Map.of("type", "object",
                "properties", Map.of("kids", Map.of("type", "array", "items", Map.of("$ref", "#/$defs/node"))));

        for (String ref : List.of("#/$defs/a", "#/$defs/b", "#/$defs/l/anyOf/1", "#/$defs/e~0~1x", "#", "#/$defs/l")) {
            assertThat(ref, ExtensionTools.schemaError(Map.of("properties", Map.of("p", Map.of("$ref", ref)), "$defs", defs)),
                    nullValue());
        }
        assertThat(ExtensionTools.schemaError(Map.of("$ref", "#/$defs/node", "$defs", Map.of("node", node))), nullValue());
        assertThat(ExtensionTools.schemaError(Map.of("properties", Map.of("a", Map.of("$ref", "#/$defs/b")),
                "$defs", Map.of("b", Map.of("$ref", "#/$defs/c"), "c", Map.of("type", "string")))), nullValue());
        assertThat(ExtensionTools.schemaError(Map.of("prefixItems", List.of(Map.of("type", "string")), "contains", Map.of("$ref", "#/prefixItems/0"))),
                nullValue());
    }

    @Test
    void refuse_a_ref_that_is_not_a_local_json_pointer() {
        for (String ref : List.of("https://example.com/a.json", "other.json", "urn:example:a#/x", "", "#a", "#$defs/a")) {
            assertThat(ref, ExtensionTools.schemaError(Map.of("properties", Map.of("p", Map.of("$ref", ref)))),
                    is("/properties/p/$ref: '" + ref + "' is not a local JSON Pointer such as #/$defs/name. CALM Hub and MCP "
                            + "clients do not fetch remote schemas"));
        }
        assertThat(ExtensionTools.schemaError(Map.of("allOf", List.of(Map.of("$ref", "https://example.com/a.json")))),
                startsWith("/allOf/0/$ref: "));
        assertThat(ExtensionTools.schemaError(Map.of("$defs", Map.of("enum", Map.of("$ref", "https://example.com/b.json")))),
                startsWith("/$defs/enum/$ref: "));
    }

    @Test
    void refuse_a_ref_that_points_to_no_subschema() {
        Map<String, Object> defs = Map.of("a", Map.of("type", "string"), "l", Map.of("anyOf", List.of(Map.of(), true)),
                "d", Map.of("dependencies", Map.of("x", List.of("y"))));

        for (String ref : List.of("#/$defs/missing", "#/$defs/a/type", "#/$defs/l/anyOf/2", "#/$defs/l/anyOf/x", "#/$defs/l/anyOf",
                "#/$defs", "#/properties", "#/$defs/", "#/$defs/a/", "#/$defs/d/dependencies/x", "#/$defs/a/x-ext")) {
            assertThat(ref, ExtensionTools.schemaError(Map.of("properties", Map.of("p", Map.of("$ref", ref)), "$defs", defs)),
                    is("/properties/p/$ref: '" + ref + "' points to no subschema"));
        }
        assertThat(ExtensionTools.schemaError(Map.of("properties", Map.of("a", Map.of("$ref", "#/$defs/b")),
                "$defs", Map.of("b", Map.of("$ref", "#/$defs/missing")))), containsString("points to no subschema"));
    }

    @Test
    void refuse_a_ref_that_leads_only_to_a_loop_of_refs() {
        assertThat(ExtensionTools.schemaError(Map.of("properties", Map.of("x", Map.of("$ref", "#/properties/x")))),
                is("/properties/x/$ref: '#/properties/x' leads only to a loop of $refs"));
        assertThat(ExtensionTools.schemaError(Map.of("properties", Map.of("a", Map.of("$ref", "#/$defs/b")),
                "$defs", Map.of("b", Map.of("$ref", "#/$defs/c"), "c", Map.of("$ref", "#/$defs/b")))), containsString("loop of $refs"));
        assertThat(ExtensionTools.schemaError(Map.of("type", "object", "$ref", "#")), is("/$ref: '#' leads only to a loop of $refs"));
    }

    @Test
    void publish_boolean_subschemas_as_objects() {
        Map<String, Object> never = Map.of("not", Map.of());
        Map<String, Object> schema = Map.of(
                "type", "object",
                "properties", Map.of("a", true, "b", false, "c", Map.of("type", "array", "items", true, "uniqueItems", true)),
                "additionalProperties", false,
                "unevaluatedItems", false,
                "allOf", List.of(true, Map.of("not", false)),
                "$defs", Map.of("d", true),
                "dependencies", Map.of("a", List.of("b")),
                "readOnly", true,
                "x-flag", true,
                "const", true);

        Map<String, Object> published = ExtensionTools.published(schema);

        assertThat(published.get("properties"), is(Map.of("a", Map.of(), "b", never,
                "c", Map.of("type", "array", "items", Map.of(), "uniqueItems", true))));
        assertThat(published.get("additionalProperties"), is(false));
        assertThat(published.get("unevaluatedItems"), is(never));
        assertThat(published.get("allOf"), is(List.of(Map.of(), Map.of("not", never))));
        assertThat(published.get("$defs"), is(Map.of("d", Map.of())));
        assertThat(published.get("dependencies"), is(Map.of("a", List.of("b"))));
        assertThat(published.get("readOnly"), is(true));
        assertThat(published.get("x-flag"), is(true));
        assertThat(published.get("const"), is(true));
    }

    @Test
    void publish_and_check_a_command_with_boolean_subschemas() {
        ExtensionTools.ExtensionTool annotate = tool("annotate");

        assertThat(((Map<?, ?>) annotate.inputSchema().get("properties")).get("note"), is(Map.of()));
        assertThat(((Map<?, ?>) annotate.inputSchema().get("properties")).get("never"), is(Map.of("not", Map.of())));
        assertThat(((Map<?, ?>) annotate.outputSchema().get("properties")).get("hits"), is(Map.of()));
        ToolResponse response = extensionTools.call(annotate, Map.of("text", "a", "note", 1, "never", 2));
        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("/never"));
        verify(proxyService, never()).call(any(), any());
    }

    @Test
    void match_a_one_megabyte_argument_against_a_repeated_group() {
        ExtensionManifest.Route route = new ExtensionManifest.Route("r", "POST", "/r", "authenticated", false);
        Map<String, Object> input = Map.of("type", "object",
                "properties", Map.of("text", Map.of("type", "string", "pattern", "^(a|b)*$")));
        ExtensionManifest manifest = new ExtensionManifest("x", "1.0.0", 0, "X", "X", "X", List.of(route),
                Map.of("c", new ExtensionManifest.Command("r", "C", input, null, null, null)), null);
        ExtensionTools.ExtensionTool command = ExtensionTools.tools(List.of(manifest)).getFirst();

        when(proxyService.call(any(), any())).thenReturn(reply(200, "{}"));

        ToolResponse ok = extensionTools.call(command, Map.of("text", "ab".repeat(500_000)));
        ToolResponse refused = extensionTools.call(command, Map.of("text", "ab".repeat(500_000) + "c"));

        assertThat(ok.isError(), is(false));
        assertThat(text(refused), containsString("/text: String does not match pattern"));
    }


    @ParameterizedTest
    @ValueSource(strings = {"a{99}b", "(?:\\s?){99}x", "(?:a{10,}|b*){9}c"})
    void check_a_one_megabyte_argument_against_the_largest_accepted_patterns_in_linear_time(String pattern) {
        ExtensionTools.ExtensionTool command = textCommand(pattern);

        long start = System.nanoTime();
        ToolResponse response = extensionTools.call(command, Map.of("text", "a".repeat(ExtensionTools.MAX_ARGUMENTS_BYTES - 20)));

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("/text: String does not match pattern"));
        // Linear time takes well under a second; a backtracking matcher would take hours. The margin is for slow runners.
        assertThat(Duration.ofNanos(System.nanoTime() - start).toMillis() < 30_000, is(true));
    }

    @Test
    void refuse_arguments_larger_than_one_megabyte_before_the_input_check() {
        ExtensionTools.ExtensionTool command = textCommand("^a*$");

        ToolResponse response = extensionTools.call(command, Map.of("text", "a".repeat(ExtensionTools.MAX_ARGUMENTS_BYTES)));

        assertThat(text(response), is("Error: The arguments are larger than 1048576 bytes of JSON."));
        verify(proxyService, never()).checkAccess(any(), any());
        verify(proxyService, never()).call(any(), any());
    }

    @Test
    void refuse_deeply_nested_arguments_and_stay_ready_for_the_next_call() {
        ExtensionTools.ExtensionTool command = textCommand("^a*$");
        List<Object> deep = new ArrayList<>();
        List<Object> level = deep;
        for (int i = 0; i < 10_000; i++) {
            List<Object> next = new ArrayList<>();
            level.add(next);
            level = next;
        }

        ToolResponse refused = extensionTools.call(command, Map.of("deep", deep));

        assertThat(text(refused), is("Error: The arguments are nested too deeply."));
        verify(proxyService, never()).checkAccess(any(), any());
        verify(proxyService, never()).call(any(), any());

        when(proxyService.call(any(), any())).thenReturn(reply(200, "{}"));
        assertThat(extensionTools.call(command, Map.of("text", "aaa")).isError(), is(false));
    }

    private static ExtensionTools.ExtensionTool textCommand(String pattern) {
        ExtensionManifest.Route route = new ExtensionManifest.Route("r", "POST", "/r", "authenticated", false);
        Map<String, Object> input = Map.of("type", "object",
                "properties", Map.of("text", Map.of("type", "string", "pattern", pattern)));
        ExtensionManifest manifest = new ExtensionManifest("x", "1.0.0", 0, "X", "X", "X", List.of(route),
                Map.of("c", new ExtensionManifest.Command("r", "C", input, null, null, null)), null);
        return ExtensionTools.tools(List.of(manifest)).getFirst();
    }
    @Test
    void check_the_scope_before_the_input() {
        doThrow(new ExtensionProxyException(403, "You do not have the scope that this extension route needs"))
                .when(proxyService).checkAccess(same(identity), any());

        ToolResponse response = extensionTools.call(tool("slow-pattern"),
                Map.of("namespace", "finos", "text", "a".repeat(60) + "!", "extra", 1));

        assertThat(text(response), is("Error: You do not have the scope that this extension route needs"));
        verify(proxyService, never()).call(any(), any());
    }

    @Test
    void match_the_input_against_slow_patterns_in_linear_time() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            String text = "a".repeat(100_000) + "!";
            for (String property : List.of("text", "empty", "choice")) {
                long start = System.nanoTime();
                ToolResponse slow = executor.submit(() -> extensionTools.call(tool("slow-pattern"),
                        Map.of("namespace", "finos", property, text))).get(60, TimeUnit.SECONDS);

                assertThat(property, text(slow), containsString("\n- /" + property + ": String does not match pattern"));
                assertThat(property, Duration.ofNanos(System.nanoTime() - start).toMillis() < 30_000, is(true));
            }
            verify(proxyService, never()).call(any(), any());

            when(proxyService.call(any(), any())).thenReturn(reply(200, "{}"));
            ToolResponse fast = executor.submit(() -> extensionTools.call(tool("slow-pattern"),
                    Map.of("namespace", "finos", "text", "a".repeat(12), "choice", "aab"))).get(30, TimeUnit.SECONDS);
            assertThat(fast.isError(), is(false));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void check_pattern_properties_and_the_additional_properties_next_to_them() {
        ExtensionTools.InputSchema schema = ExtensionTools.InputSchema.of("x", "c", ExtensionTools.published(Map.of(
                "type", "object",
                "properties", Map.of("name", Map.of("type", "string")),
                "patternProperties", Map.of("^x-", Map.of("$ref", "#/$defs/count"), "^(.*a){12}$", Map.of("type", "string")),
                "additionalProperties", false,
                "propertyNames", Map.of("pattern", "^[a-z-]+$"),
                "$defs", Map.of("count", Map.of("type", "integer")))));
        String slow = "a".repeat(100_000);

        assertThat(schema.validate(new JsonObject().put("name", "n").put("x-a", 1).put(slow, "s")).getValid(), is(true));
        assertThat(schema.validate(new JsonObject().put("x-a", "1")).getValid(), is(false));
        assertThat(schema.validate(new JsonObject().put(slow, 1)).getValid(), is(false));
        assertThat(schema.validate(new JsonObject().put("other", 1)).getValid(), is(false));
        assertThat(schema.validate(new JsonObject().put("X", 1)).getValid(), is(false));

        ExtensionTools.InputSchema open = ExtensionTools.InputSchema.of("x", "c", Map.of(
                "patternProperties", Map.of("^x-", Map.of("type", "integer")),
                "additionalProperties", Map.of("type", "string"),
                "items", Map.of("pattern", "^a")));
        assertThat(open.validate(new JsonObject().put("x-a", 1).put("b", "s")).getValid(), is(true));
        assertThat(open.validate(new JsonObject().put("b", 1)).getValid(), is(false));
        assertThat(open.validate(new JsonObject().put("x-a", "s")).getValid(), is(false));
    }

    @Test
    void keep_the_meaning_of_a_pattern_under_any_applicator() {
        ExtensionTools.InputSchema schema = ExtensionTools.InputSchema.of("x", "c", Map.of(
                "properties", Map.of(
                        "a", Map.of("anyOf", List.of(Map.of("pattern", "^x"), Map.of("pattern", "^y"))),
                        "b", Map.of("not", Map.of("pattern", "^z")),
                        "c", Map.of("if", Map.of("pattern", "^1"), "then", Map.of("maxLength", 1)),
                        "d", Map.of("pattern", "^d", "allOf", List.of(Map.of("minLength", 2))))));

        assertThat(schema.validate(new JsonObject().put("a", "y").put("b", "a").put("c", "1").put("d", "dd")).getValid(), is(true));
        assertThat(schema.validate(new JsonObject().put("a", "z")).getValid(), is(false));
        assertThat(schema.validate(new JsonObject().put("b", "zz")).getValid(), is(false));
        assertThat(schema.validate(new JsonObject().put("c", "12")).getValid(), is(false));
        assertThat(schema.validate(new JsonObject().put("c", "22")).getValid(), is(true));
        assertThat(schema.validate(new JsonObject().put("d", "d")).getValid(), is(false));
        assertThat(schema.validate(new JsonObject().put("d", "ed")).getValid(), is(false));
    }

    @Test
    void refuse_an_input_format_that_hub_cannot_check_in_linear_time() {
        for (String format : List.of("url", "uri", "uri-reference", "uri-template", "regex", "byte", "json-pointer",
                "relative-json-pointer", "json-pointer-uri-fragment", "idn-hostname", "idn-email", "custom")) {
            assertThat(format, ExtensionTools.inputSchemaError(Map.of("properties", Map.of("a", Map.of("format", format)))),
                    is("/properties/a/format: '" + format + "' cannot be in an input schema: CALM Hub can check only date, "
                            + "date-time, duration, email, hostname, ipv4, ipv6, time, uuid in linear time"));
        }
        for (String format : ExtensionTools.LINEAR_FORMATS) {
            assertThat(format, ExtensionTools.inputSchemaError(Map.of("format", format)), nullValue());
        }
        assertThat(ExtensionTools.schemaError(Map.of("format", "url")), nullValue());
    }

    @Test
    void check_each_allowed_format_in_linear_time_on_1_mb() {
        List<String> units = List.of("a", "0", "a.", "0.", "a-", "-", ":", "0:", "::", "a@", "@", ".", "1-1-", "P1Y", "T1H",
                "aa:", "0.0.", "a-a.", "f:", "1Z", "%", "a b", "\\", "\"", "[", "x@a.", "0-", "01:01:", "+00:00");
        for (String format : ExtensionTools.LINEAR_FORMATS) {
            ExtensionTools.InputSchema schema = ExtensionTools.InputSchema.of("x", "c",
                    Map.of("properties", Map.of("v", Map.of("type", "string", "format", format))));
            for (String unit : units) {
                String text = unit.repeat(1_000_000 / unit.length()) + "!";
                long start = System.nanoTime();
                schema.validate(new JsonObject().put("v", text));
                long millis = Duration.ofNanos(System.nanoTime() - start).toMillis();
                assertThat(format + " on " + unit + " took " + millis + " ms", millis < 2_000, is(true));
            }
        }
    }

    @Test
    void refuse_an_input_pattern_that_has_no_linear_time_form() {
        String lookahead = "(?:|)".repeat(40) + "(?!)";

        assertThat(ExtensionTools.inputSchemaError(Map.of("properties", Map.of("a", Map.of("pattern", lookahead)))),
                is("/properties/a/pattern: '" + lookahead.substring(0, 60) + "...' cannot be in an input schema: it has a "
                        + "lookahead, which CALM Hub cannot match in linear time"));
        assertThat(ExtensionTools.inputSchemaError(Map.of("patternProperties", Map.of("(a)\\1", Map.of()))),
                is("/patternProperties: the key '(a)\\1' cannot be in an input schema: it has a back reference, which "
                        + "CALM Hub cannot match in linear time"));
        assertThat(ExtensionTools.inputSchemaError(Map.of("pattern", "(?<=a)b")), containsString("it has a lookbehind"));
        assertThat(ExtensionTools.inputSchemaError(Map.of("pattern", "[\\S]")), containsString("\\S in a character class"));
        assertThat(ExtensionTools.inputSchemaError(Map.of("pattern", "\\p{ASCII}")), containsString("the Unicode property \\p{ASCII}"));
        assertThat(ExtensionTools.inputSchemaError(Map.of("pattern", "a{101}")), containsString("expand it to more than 100 "));
        assertThat(ExtensionTools.inputSchemaError(Map.of("pattern", "(?:(?:a{1000}){1000}){1000}")),
                containsString("expand it to more than 100 "));
        assertThat(ExtensionTools.inputSchemaError(Map.of("pattern", "(?i)a")), containsString("not an ECMA-262"));
        // Output schemas keep the ECMA-262 rules.
        assertThat(ExtensionTools.schemaError(Map.of("pattern", lookahead)), nullValue());
        assertThat(ExtensionTools.inputSchemaError(Map.of("properties", Map.of("a", Map.of("pattern", "^(.*a){12}$")))),
                nullValue());
    }

    @Test
    void refuse_unevaluated_properties_or_refs_into_pattern_properties_in_an_input_schema() {
        Map<String, Object> patternProperties = Map.of("x-", Map.of("type", "integer"));

        assertThat(ExtensionTools.inputSchemaError(Map.of("patternProperties", patternProperties,
                        "allOf", List.of(Map.of("unevaluatedProperties", false)))),
                is("/allOf/0/unevaluatedProperties: CALM Hub does not support unevaluatedProperties in an input schema "
                        + "that has patternProperties"));
        assertThat(ExtensionTools.inputSchemaError(Map.of("patternProperties", patternProperties,
                        "properties", Map.of("a", Map.of("$ref", "#/patternProperties/x-")))),
                containsString("/properties/a/$ref: '#/patternProperties/x-' points into patternProperties"));
        assertThat(ExtensionTools.inputSchemaError(Map.of("patternProperties", patternProperties,
                        "additionalProperties", Map.of("type", "string"),
                        "properties", Map.of("a", Map.of("$ref", "#/additionalProperties")))),
                containsString("points into patternProperties, or into the additionalProperties next to them"));
        assertThat(ExtensionTools.inputSchemaError(Map.of("additionalProperties", Map.of("type", "string"),
                "properties", Map.of("a", Map.of("$ref", "#/additionalProperties")))), nullValue());
        assertThat(ExtensionTools.inputSchemaError(Map.of("unevaluatedProperties", false)), nullValue());
    }

    @Test
    void register_no_tools_with_no_extensions() {
        when(registry.available()).thenReturn(List.of());

        extensionTools.register();

        verifyNoInteractions(toolManager);
    }

    @Test
    void register_no_tools_when_mcp_is_disabled() {
        extensionTools.mcpEnabled = false;

        extensionTools.register();

        verifyNoInteractions(toolManager, registry);
    }

    @Test
    void register_the_other_tools_when_one_cannot_be_registered() {
        when(registry.available()).thenReturn(MANIFESTS);
        when(toolManager.newTool(anyString())).thenReturn(definition);
        when(definition.register()).thenThrow(new ClassCastException("not a JsonObject")).thenReturn(null);

        extensionTools.register();

        verify(definition, times(8)).register();
        verify(toolManager).removeTool(TOOLS.get(0).name());
        verify(toolManager, times(1)).removeTool(anyString());
    }

    @Test
    void not_register_or_remove_a_tool_whose_name_is_already_taken() {
        when(toolManager.getTool("ext_mcp-test_search")).thenReturn(mock(ToolManager.ToolInfo.class));
        when(toolManager.newTool(anyString())).thenReturn(definition);

        extensionTools.register(List.of(tool("search"), tool("annotate")));

        verify(toolManager, never()).newTool("ext_mcp-test_search");
        verify(toolManager).newTool("ext_mcp-test_annotate");
        verify(definition, times(1)).register();
        verify(toolManager, never()).removeTool(anyString());
    }

    @Test
    void register_the_other_tools_when_a_failed_tool_cannot_be_removed() {
        when(toolManager.newTool(anyString())).thenReturn(definition);
        when(definition.register()).thenThrow(new ClassCastException("not a JsonObject")).thenReturn(null);
        when(toolManager.removeTool(anyString())).thenThrow(new IllegalStateException("gone"));

        extensionTools.register(List.of(tool("search"), tool("annotate")));

        verify(definition, times(2)).register();
    }

    @Test
    void register_the_other_tools_when_one_overflows_the_stack() {
        when(toolManager.newTool(anyString())).thenReturn(definition);
        when(definition.register()).thenThrow(new StackOverflowError()).thenReturn(null);
        when(toolManager.removeTool(anyString())).thenThrow(new StackOverflowError());

        extensionTools.register(List.of(tool("search"), tool("annotate")));

        verify(definition, times(2)).register();
        verify(toolManager).removeTool("ext_mcp-test_search");
    }

    @Test
    void skip_a_command_whose_schema_check_overflows_or_whose_route_is_not_declared() {
        ExtensionManifest.Route route = new ExtensionManifest.Route("r", "GET", "/r", "authenticated", false);
        Map<String, Object> input = Map.of("type", "object");
        // A schema check that overflows the stack must skip only its own command.
        Map<String, Object> overflowing = new HashMap<>(Map.of("type", "object")) {
            @Override
            public Object get(Object key) {
                throw new StackOverflowError();
            }
        };
        ExtensionManifest manifest = new ExtensionManifest("bad", "1.0.0", 0, "B", "B", "B", List.of(route), Map.of(
                "overflowing", new ExtensionManifest.Command("r", "C", overflowing, null, null, null),
                "no-route", new ExtensionManifest.Command("missing", "C", input, null, null, null),
                "good", new ExtensionManifest.Command("r", "C", input, null, null, null)), null);

        assertThat(ExtensionTools.tools(List.of(manifest)).stream().map(ExtensionTools.ExtensionTool::name).toList(),
                contains("ext_bad_good"));
    }

    @Test
    void name_the_input_schema_when_it_cannot_be_read() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> ExtensionTools.InputSchema.of("x", "c", Map.of("type", new Object())));

        assertThat(e.getMessage(), startsWith("CALM Hub cannot read its input schema: "));
    }

    @Test
    void mark_a_get_or_read_only_route_as_read_only() {
        ToolManager.ToolAnnotations list = ExtensionTools.annotations(tool("list-services"));
        ToolManager.ToolAnnotations search = ExtensionTools.annotations(tool("search"));

        assertThat(list.readOnlyHint(), is(true));
        assertThat(list.destructiveHint(), is(false));
        assertThat(list.idempotentHint(), is(true));
        assertThat(search.readOnlyHint(), is(true));
        assertThat(search.destructiveHint(), is(false));
    }

    @Test
    void take_the_write_hints_from_the_manifest() {
        ToolManager.ToolAnnotations add = ExtensionTools.annotations(tool("add-service"));
        ToolManager.ToolAnnotations remove = ExtensionTools.annotations(tool("remove-service"));

        assertThat(add.readOnlyHint(), is(false));
        assertThat(add.destructiveHint(), is(false));
        assertThat(add.idempotentHint(), is(false));
        assertThat(remove.destructiveHint(), is(true));
        assertThat(remove.idempotentHint(), is(true));
        assertThat(remove.openWorldHint(), is(true));
    }

    @Test
    void use_the_mcp_defaults_for_a_write_with_no_hints() {
        ExtensionManifest.Route route = new ExtensionManifest.Route("r", "POST", "/r", "authenticated", false);
        ExtensionManifest manifest = new ExtensionManifest("x", "1.0.0", 0, "X", "X", "X", List.of(route),
                Map.of("c", new ExtensionManifest.Command("r", "C", Map.of("type", "object"), null, null, null)), null);

        ToolManager.ToolAnnotations hints = ExtensionTools.annotations(ExtensionTools.tools(List.of(manifest)).getFirst());

        assertThat(hints.destructiveHint(), is(true));
        assertThat(hints.idempotentHint(), is(false));
    }

    // --- request mapping ---

    @Test
    void fill_the_path_and_send_the_rest_as_the_query_for_get() {
        ExtensionProxyRequest request = ExtensionTools.request(tool("list-services"),
                new JsonObject("{\"namespace\":\"finos\",\"limit\":5,\"tag\":[\"a b\",\"c\"]}"));

        assertThat(request.extensionId(), is("mcp-test"));
        assertThat(request.method(), is("GET"));
        assertThat(request.path(), is("/namespaces/finos/services"));
        assertThat(request.rawQuery(), is("limit=5&tag=a+b&tag=c"));
        assertThat(request.body(), nullValue());
    }

    @Test
    void send_an_object_or_null_in_the_query_as_json() {
        ExtensionProxyRequest request = ExtensionTools.request(tool("remove-service"),
                new JsonObject("{\"namespace\":\"finos\",\"name\":\"svc\",\"filter\":{\"a\":1},\"none\":null}"));

        assertThat(request.method(), is("DELETE"));
        assertThat(request.path(), is("/namespaces/finos/services/svc"));
        assertThat(request.rawQuery(), is("filter=%7B%22a%22%3A1%7D&none=null"));
    }

    @Test
    void send_no_query_when_the_path_takes_every_property() {
        ExtensionProxyRequest request = ExtensionTools.request(tool("list-services"), new JsonObject("{\"namespace\":\"finos\"}"));

        assertThat(request.rawQuery(), nullValue());
    }

    @Test
    void send_the_rest_as_a_json_body_for_post() throws IOException {
        ExtensionProxyRequest request = ExtensionTools.request(tool("add-service"),
                new JsonObject("{\"namespace\":\"finos\",\"service\":{\"name\":\"svc\"}}"));

        assertThat(request.method(), is("POST"));
        assertThat(request.path(), is("/namespaces/finos/services"));
        assertThat(request.contentType(), is("application/json"));
        assertThat(body(request), is("{\"service\":{\"name\":\"svc\"}}"));
    }

    @Test
    void encode_a_path_value_so_it_cannot_add_a_segment() {
        ExtensionProxyRequest request = ExtensionTools.request(tool("remove-service"),
                new JsonObject("{\"namespace\":\"finos\",\"name\":\".a?c#d é~\"}"));

        assertThat(request.path(), is("/namespaces/finos/services/.a%3Fc%23d%20%C3%A9~"));
    }

    // --- the path value rule: the clients test the same list (extensions-test/path-values.json) ---

    @ParameterizedTest
    @MethodSource("refusedPathValues")
    void refuse_a_path_value_that_hub_refuses_once_it_is_encoded(String value) {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(
                tool("remove-service"), new JsonObject().put("namespace", "finos").put("name", value)));

        assertThat(e.getMessage(), is("Input property 'name' " + PATH_RULE + ", because it fills the path "
                + tool("remove-service").route().path()));
        for (String encoded : List.of(ExtensionTools.encodePathValue(value), strictlyEncoded(value))) {
            assertThrows(ExtensionProxyException.class, () -> ExtensionPaths.checkPath("/x/" + encoded + "/y"), encoded);
        }
    }

    @ParameterizedTest
    @MethodSource("acceptedPathValues")
    void accept_a_path_value_that_hub_accepts_once_it_is_encoded(String value) {
        ExtensionProxyRequest request = ExtensionTools.request(tool("remove-service"),
                new JsonObject().put("namespace", "finos").put("name", value));

        assertThat(request.path(), is("/namespaces/finos/services/" + ExtensionTools.encodePathValue(value)));
        // Hub accepts and keeps !*'() both raw and encoded.
        for (String encoded : List.of(ExtensionTools.encodePathValue(value), strictlyEncoded(value))) {
            assertThat(ExtensionPaths.checkPath("/x/" + encoded + "/y"), is("/x/" + encoded + "/y"));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"\ud800", "a\udc00b", "\udbff\ud800"})
    void refuse_a_path_value_with_a_lone_surrogate(String value) {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(
                tool("remove-service"), new JsonObject().put("namespace", "finos").put("name", value)));

        assertThat(e.getMessage(), startsWith("Input property 'name' " + PATH_RULE));
    }

    @Test
    void cover_each_part_that_hub_refuses_with_a_refused_path_value() {
        List<String> encodedNever = PATH_VALUES.getJsonArray("encodedNever").stream().map(String.class::cast).toList();
        for (String part : ExtensionPaths.FORBIDDEN) {
            boolean covered = refusedPathValues().anyMatch(value -> value.toLowerCase(Locale.ROOT).contains(part)
                    || ExtensionTools.encodePathValue(value).toLowerCase(Locale.ROOT).contains(part));
            assertThat(part, covered || encodedNever.contains(part), is(true));
        }
        for (String part : encodedNever) {
            assertThat(part, ExtensionPaths.FORBIDDEN.contains(part), is(true));
            assertThat(part, ExtensionTools.encodePathValue(part).contains(part), is(false));
        }
    }

    @ParameterizedTest
    @MethodSource("encodedValues")
    void encode_a_value_in_the_path_and_the_query_as_the_shared_client_does(JsonObject encoded) {
        String value = encoded.getString("value");
        ExtensionProxyRequest request = ExtensionTools.request(tool("remove-service"),
                new JsonObject().put("namespace", "finos").put("name", value).put("q", value));

        assertThat(request.path(), is("/namespaces/finos/services/" + encoded.getString("path")));
        assertThat(request.rawQuery(), is("q=" + encoded.getString("query")));
    }

    @ParameterizedTest
    @MethodSource("otherRouteRefusedValues")
    void refuse_a_shared_value_that_fills_the_path_so_that_it_matches_another_route(String value) {
        ExtensionTools.ExtensionTool tool = otherRouteTool();

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> ExtensionTools.request(tool, new JsonObject().put("name", value)));

        assertThat(e.getMessage(), is("The input fills the path /services/{name} so that it matches route 'get-admin', "
                + "not route 'get-service' of this command."));
    }

    @ParameterizedTest
    @MethodSource("otherRouteAcceptedValues")
    void accept_a_shared_value_that_fills_the_path_of_its_own_route(String value) {
        assertThat(ExtensionTools.request(otherRouteTool(), new JsonObject().put("name", value)).path(), is("/services/" + value));
    }

    @Test
    void refuse_a_missing_or_null_path_value_as_required() {
        String message = "Input property 'name' is required, because it fills the path "
                + tool("remove-service").route().path();

        assertThat(assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(tool("remove-service"),
                new JsonObject().put("namespace", "finos"))).getMessage(), is(message));
        assertThat(assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(tool("remove-service"),
                new JsonObject("{\"namespace\":\"finos\",\"name\":null}"))).getMessage(), is(message));
    }

    @Test
    void write_a_number_in_the_path_and_the_query_in_plain_notation() {
        ExtensionProxyRequest request = ExtensionTools.request(tool("remove-service"),
                new JsonObject("{\"namespace\":1.0,\"name\":1e21,\"limit\":1.50,\"small\":1.5e-7,\"big\":9007199254740993}"));

        assertThat(request.path(), is("/namespaces/1/services/1000000000000000000000"));
        assertThat(request.rawQuery(), is("limit=1.5&small=0.00000015&big=9007199254740993"));
    }

    @Test
    void write_a_big_decimal_and_a_float_in_plain_notation() {
        assertThat(ExtensionTools.scalarText(new BigDecimal("1.2300E+5")), is("123000"));
        assertThat(ExtensionTools.scalarText(new BigDecimal("0.000")), is("0"));
        assertThat(ExtensionTools.scalarText(2.5f), is("2.5"));
        assertThat(ExtensionTools.scalarText(-0.0), is("0"));
        assertThat(ExtensionTools.scalarText(new BigInteger("123456789012345678901234567890")), is("123456789012345678901234567890"));
        assertThat(ExtensionTools.scalarText(true), is("true"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"a\nb", "a\tb", "a\u0000b", "a\u007fb", "\ud800", "a\udc00b"})
    void refuse_a_query_value_or_name_that_hub_refuses_and_name_the_property(String value) {
        String message = "must not contain a control character or a lone surrogate, because it goes in the query";

        assertThat(assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(tool("list-services"),
                new JsonObject().put("namespace", "finos").put("q", value))).getMessage(), is("Input property 'q' " + message));
        assertThat(assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(tool("list-services"),
                new JsonObject().put("namespace", "finos").put("tag", new JsonArray().add("ok").add(value)))).getMessage(),
                is("Input property 'tag' " + message));
        assertThat(assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(tool("list-services"),
                new JsonObject().put("namespace", "finos").put(value, "x"))).getMessage(), is("Input property '" + value + "' " + message));
    }

    @Test
    void send_a_control_character_in_an_object_query_value_or_a_body_as_json() throws IOException {
        ExtensionProxyRequest query = ExtensionTools.request(tool("list-services"),
                new JsonObject().put("namespace", "finos").put("filter", new JsonObject().put("q", "a\nb")));
        ExtensionProxyRequest body = ExtensionTools.request(tool("add-service"),
                new JsonObject().put("namespace", "finos").put("note", "a\nb"));

        assertThat(query.rawQuery(), is("filter=%7B%22q%22%3A%22a%5Cnb%22%7D"));
        assertThat(body(body), is("{\"note\":\"a\\nb\"}"));
    }

    @Test
    void refuse_a_parameter_value_that_matches_another_route() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(
                tool("get-service"), new JsonObject().put("service", "admin")));

        assertThat(e.getMessage(), is("The input fills the path /services/{service} so that it matches route "
                + "'service-admin', not route 'service' of this command."));
        assertThat(ExtensionTools.request(tool("get-service"), new JsonObject().put("service", "admins")).path(),
                is("/services/admins"));
    }

    @Test
    void return_a_value_that_matches_another_route_as_a_tool_error_before_the_scope_check() {
        ToolResponse response = extensionTools.call(tool("get-service"), Map.of("service", "admin"));

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error: The input fills the path /services/{service} so that it matches route"));
        verify(proxyService, never()).checkAccess(any(), any());
        verify(proxyService, never()).call(any(), any());
    }

    // GET /api/calm/extensions/mcp-test/api/namespaces/finos/services?x=<value> HTTP/1.1
    private static final int LIST_SERVICES_LINE = "GET /api/calm/extensions/mcp-test/api/namespaces/finos/services?x= HTTP/1.1".length();

    @Test
    void accept_a_request_line_of_the_rest_limit() {
        String value = "a".repeat(ExtensionTools.MAX_REQUEST_LINE_LENGTH - LIST_SERVICES_LINE);

        ExtensionProxyRequest request = ExtensionTools.request(tool("list-services"),
                new JsonObject().put("namespace", "finos").put("x", value));

        assertThat(request.rawQuery(), is("x=" + value));
    }

    @Test
    void refuse_a_request_line_longer_than_the_rest_limit() {
        String value = "a".repeat(ExtensionTools.MAX_REQUEST_LINE_LENGTH - LIST_SERVICES_LINE + 1);
        // POST /api/calm/extensions/mcp-test/api/namespaces/<namespace>/services HTTP/1.1
        String namespace = "a".repeat(ExtensionTools.MAX_REQUEST_LINE_LENGTH
                - "POST /api/calm/extensions/mcp-test/api/namespaces//services HTTP/1.1".length() + 1);

        IllegalArgumentException query = assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(
                tool("list-services"), new JsonObject().put("namespace", "finos").put("x", value)));
        IllegalArgumentException path = assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(
                tool("add-service"), new JsonObject().put("namespace", namespace)));
        ExtensionProxyRequest longest = ExtensionTools.request(tool("add-service"),
                new JsonObject().put("namespace", namespace.substring(1)));

        assertThat(query.getMessage(), is(LINE_TOO_LONG));
        assertThat(path.getMessage(), is(LINE_TOO_LONG));
        assertThat(longest.path(), is("/namespaces/" + namespace.substring(1) + "/services"));
    }

    @Test
    void return_a_long_query_as_a_tool_error_without_calling_the_extension() {
        ToolResponse response = extensionTools.call(tool("list-services"),
                Map.of("namespace", "finos", "tag", List.of("a".repeat(ExtensionTools.MAX_REQUEST_LINE_LENGTH))));

        assertThat(response.isError(), is(true));
        assertThat(text(response), is("Error: " + LINE_TOO_LONG));
        verify(proxyService, never()).checkAccess(any(), any());
        verify(proxyService, never()).call(any(), any());
    }

    @Test
    void refuse_an_object_in_the_path() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> ExtensionTools.request(
                tool("remove-service"), new JsonObject("{\"namespace\":\"finos\",\"name\":{}}")));

        assertThat(e.getMessage(), containsString("must be a string, number or boolean"));
    }

    // --- call ---

    @Test
    void return_the_structured_reply_of_a_command_with_an_output_schema() {
        when(proxyService.call(any(), any())).thenReturn(reply(200, "{\"services\":[\"a\"]}"));

        ToolResponse response = extensionTools.call(tool("list-services"), Map.of("namespace", "finos"));

        assertThat(response.isError(), is(false));
        assertThat(response.structuredContent(), is(Map.of("services", List.of("a"))));
        assertThat(text(response), is("{\"services\":[\"a\"]}"));
        ArgumentCaptor<ExtensionProxyRequest> request = ArgumentCaptor.forClass(ExtensionProxyRequest.class);
        verify(proxyService).call(same(identity), request.capture());
        assertThat(request.getValue().path(), is("/namespaces/finos/services"));
    }

    private ExtensionProxyRequest callWithForwardedFor(boolean captureSourceIp) {
        CurrentVertxRequest currentRequest = mock(CurrentVertxRequest.class);
        RoutingContext context = mock(RoutingContext.class);
        HttpServerRequest httpRequest = mock(HttpServerRequest.class);
        lenient().when(currentRequest.getCurrent()).thenReturn(context);
        lenient().when(context.request()).thenReturn(httpRequest);
        lenient().when(httpRequest.getHeader("X-Forwarded-For")).thenReturn("203.0.113.7");
        extensionTools.currentRequest = currentRequest;
        extensionTools.captureSourceIp = captureSourceIp;
        when(proxyService.call(any(), any())).thenReturn(reply(200, "{\"services\":[]}"));

        extensionTools.call(tool("list-services"), Map.of("namespace", "finos"));

        ArgumentCaptor<ExtensionProxyRequest> request = ArgumentCaptor.forClass(ExtensionProxyRequest.class);
        verify(proxyService).call(same(identity), request.capture());
        return request.getValue();
    }

    @Test
    void send_the_forwarded_for_header_of_the_mcp_request_as_the_source_ip_when_it_is_captured() {
        assertThat(callWithForwardedFor(true).sourceIp(), is("203.0.113.7"));
    }

    @Test
    void send_no_source_ip_when_it_is_not_captured() {
        assertThat(callWithForwardedFor(false).sourceIp(), nullValue());
    }

    @Test
    void send_no_source_ip_when_there_is_no_current_http_request() {
        extensionTools.captureSourceIp = true;
        extensionTools.currentRequest = mock(CurrentVertxRequest.class);
        when(proxyService.call(any(), any())).thenReturn(reply(200, "{\"services\":[]}"));

        extensionTools.call(tool("list-services"), Map.of("namespace", "finos"));

        ArgumentCaptor<ExtensionProxyRequest> request = ArgumentCaptor.forClass(ExtensionProxyRequest.class);
        verify(proxyService).call(same(identity), request.capture());
        assertThat(request.getValue().sourceIp(), nullValue());
    }

    @Test
    void return_a_reply_that_is_not_an_object_in_result() {
        when(proxyService.call(any(), any())).thenReturn(reply(200, "[\"a\",\"b\"]"));

        ToolResponse response = extensionTools.call(tool("service-names"), Map.of("namespace", "finos"));

        assertThat(response.isError(), is(false));
        assertThat(response.structuredContent(), is(Map.of("result", List.of("a", "b"))));
        assertThat(text(response), is("{\"result\":[\"a\",\"b\"]}"));
    }

    @Test
    void return_a_null_reply_in_result() {
        when(proxyService.call(any(), any())).thenReturn(reply(200, "null"));

        ToolResponse response = extensionTools.call(tool("service-names"), Map.of("namespace", "finos"));

        assertThat(response.isError(), is(false));
        assertThat(text(response), is("{\"result\":null}"));
    }

    @Test
    void return_an_error_when_a_wrapped_reply_is_not_json() {
        when(proxyService.call(any(), any())).thenReturn(reply(200, "not json"));

        ToolResponse response = extensionTools.call(tool("service-names"), Map.of("namespace", "finos"));

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("not the JSON that this command declares"));
    }

    @Test
    void return_the_reply_as_text_for_a_command_with_no_output_schema() {
        when(proxyService.call(any(), any())).thenReturn(reply(200, "{\"hits\":3}"));

        ToolResponse response = extensionTools.call(tool("search"), Map.of("text", "pay"));

        assertThat(response.isError(), is(false));
        assertThat(text(response), is("{\"hits\":3}"));
    }

    @Test
    void return_an_error_when_the_reply_is_not_the_declared_object() {
        when(proxyService.call(any(), any())).thenReturn(reply(200, "[1]"));

        ToolResponse response = extensionTools.call(tool("list-services"), Map.of("namespace", "finos"));

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("not the JSON object"));
    }

    @Test
    void return_an_error_with_the_body_of_a_client_error_reply() {
        when(proxyService.call(any(), any())).thenReturn(reply(404, "{\"error\":\"no such service\"}"));

        ToolResponse response = extensionTools.call(tool("search"), Map.of("text", "pay"));

        assertThat(response.isError(), is(true));
        assertThat(text(response), is("Error: The extension replied with status 404: {\"error\":\"no such service\"}"));
    }

    @Test
    void return_an_error_with_no_body_for_an_empty_reply() {
        when(proxyService.call(any(), any())).thenReturn(reply(409, ""));

        ToolResponse response = extensionTools.call(tool("search"), Map.of("text", "pay"));

        assertThat(text(response), is("Error: The extension replied with status 409."));
    }

    @Test
    void return_the_proxy_error_when_hub_refuses_the_call() {
        when(proxyService.call(any(), any()))
                .thenThrow(new ExtensionProxyException(403, "You do not have the scope that this extension route needs"));

        ToolResponse response = extensionTools.call(tool("list-services"), Map.of("namespace", "finos"));

        assertThat(response.isError(), is(true));
        assertThat(text(response), is("Error: You do not have the scope that this extension route needs"));
    }

    @Test
    void refuse_input_that_does_not_match_the_schema() {
        ToolResponse response = extensionTools.call(tool("list-services"), Map.of("namespace", "finos", "limit", 0, "extra", 1));

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error: The input does not match the schema of this command:"));
        assertThat(text(response), containsString("/limit"));
        assertThat(text(response).contains(" more"), is(false));
        verify(proxyService, never()).call(any(), any());
    }

    @Test
    void list_at_most_twenty_input_errors() {
        Map<String, Object> properties = new LinkedHashMap<>();
        Map<String, Object> arguments = new LinkedHashMap<>();
        for (int i = 0; i < 30; i++) {
            properties.put("p" + i, Map.of("type", "integer"));
            arguments.put("p" + i, "x");
        }
        ExtensionManifest.Route route = new ExtensionManifest.Route("r", "POST", "/r", "authenticated", false);
        ExtensionManifest manifest = new ExtensionManifest("x", "1.0.0", 0, "X", "X", "X", List.of(route),
                Map.of("c", new ExtensionManifest.Command("r", "C", Map.of("type", "object", "properties", properties),
                        null, null, null)), null);

        ToolResponse response = extensionTools.call(ExtensionTools.tools(List.of(manifest)).getFirst(), arguments);

        String[] lines = text(response).split("\n");
        assertThat(lines.length, is(1 + SchemaValidationLimits.MAX_ERRORS + 1));
        assertThat(lines[lines.length - 1].matches("- and \\d+ more"), is(true));
        verify(proxyService, never()).call(any(), any());
    }

    @Test
    void resolve_a_local_ref_in_the_input_schema() {
        ToolResponse response = extensionTools.call(tool("add-service"), Map.of("namespace", "finos", "service", Map.of("name", "")));

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("/service/name"));
        verify(proxyService, never()).call(any(), any());
    }

    @Test
    void refuse_missing_arguments() {
        ToolResponse response = extensionTools.call(tool("search"), null);

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error: The input does not match the schema"));
    }

    @Test
    void return_a_mapping_error_without_calling_the_extension() {
        ToolResponse response = extensionTools.call(tool("remove-service"), Map.of("namespace", "finos", "name", "."));

        assertThat(text(response), containsString("Input property 'name' must not be empty or ."));
        verify(proxyService, never()).call(any(), any());
    }

    @Test
    void return_disabled_error_when_mcp_is_disabled() {
        extensionTools.mcpEnabled = false;

        ToolResponse response = extensionTools.call(tool("search"), Map.of("text", "pay"));

        assertThat(text(response), is(McpValidationHelper.MCP_DISABLED_MESSAGE));
        verifyNoInteractions(proxyService);
    }
}
