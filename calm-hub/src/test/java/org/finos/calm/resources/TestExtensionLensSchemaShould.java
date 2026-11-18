package org.finos.calm.resources;

import io.vertx.core.json.JsonObject;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchema;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TestExtensionLensSchemaShould {
    private static final String REPLY = """
            {"hubApi":0,"kind":"graph","layout":{"algorithm":"layered","direction":"down"},
             "graph":{
               "groups":[{"id":"b-shop","label":"Shop","tags":["Boundary"]}],
               "nodes":[
                 {"id":"customer","label":"Customer","tags":["Element","Person"],"calm":["customer"]},
                 {"id":"api","label":"Orders API","metadata":"[Container: Java]","group":"b-shop",
                  "link":{"params":{"level":"component","scope":"api"}},"badges":[{"text":"guessed","tone":"warning"}]},
                 {"id":"orders","label":"Order","sections":{"columns":["id: uuid","total: money"]}}],
               "edges":[{"id":"e1","source":"customer","target":"api","label":"Places orders","endLabel":"0..*"}]},
             "controls":[{"type":"segmented","param":"level","items":[{"value":"context","label":"Context"}]}],
             "panels":[{"title":"Notes","blocks":[{"type":"alert","tone":"warning","text":"x"}]}]}
            """;

    private Validator validator() throws Exception {
        try (var stream = getClass().getResourceAsStream("/META-INF/calm-extensions/schema/0/lens.schema.json")) {
            var json = new JsonObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            return Validator.create(JsonSchema.of(json), new JsonSchemaOptions()
                    .setDraft(Draft.DRAFT202012).setBaseUri(json.getString("$id")));
        }
    }

    @Test
    void accept_a_graph_with_groups_controls_links_sections_and_panels() throws Exception {
        assertTrue(validator().validate(new JsonObject(REPLY)).getValid());
    }

    // The same element and extension as a Hub destination of blocks.schema.json. A length counts code points.
    static Stream<String> elements() {
        return Stream.of("orders-api", "e".repeat(256), "\uD834\uDD1E".repeat(256));
    }

    @ParameterizedTest
    @MethodSource("elements")
    void accept_a_hub_link_that_names_an_element_and_an_extension_view(String element) throws Exception {
        JsonObject reply = new JsonObject(REPLY);
        JsonObject hub = new JsonObject().put("namespace", "finos").put("type", "architectures").put("id", "shop")
                .put("version", "1.0.0").put("element", element).put("extension", "c4-model");
        reply.getJsonObject("graph").getJsonArray("nodes").getJsonObject(1).put("link", new JsonObject().put("hub", hub));

        assertTrue(validator().validate(reply).getValid());
    }

    @Test
    void accept_a_hub_link_with_no_version_as_before() throws Exception {
        JsonObject reply = new JsonObject(REPLY);
        JsonObject hub = new JsonObject().put("namespace", "finos").put("type", "patterns").put("id", "shop");
        reply.getJsonObject("graph").getJsonArray("nodes").getJsonObject(1).put("link", new JsonObject().put("hub", hub));

        assertTrue(validator().validate(reply).getValid());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/graph/nodes/1/link|{\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"shop\",\"element\":\"\"}}",
            "/graph/nodes/1/link|{\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"shop\",\"element\":\"%s\"}}",
            "/graph/nodes/1/link|{\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"shop\",\"extension\":\"C4\"}}",
            "/graph/nodes/1/link|{\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"shop\",\"tab\":\"json\"}}",
            "/graph/nodes/1/link|{\"href\":\"javascript:alert(1)\"}",
            "/graph/nodes/1/link|{\"params\":{\"a\":\"b\"},\"href\":\"https://example.org\"}",
            "/graph/nodes/0/style|\"Person\"",
            "/kind|\"sequence\"",
            "/graph/nodes/0/html|\"<b>x</b>\""})
    void reject_a_reply_outside_the_contract(String change) throws Exception {
        String[] parts = change.replace("%s", "e".repeat(257)).split("\\|", 2);
        JsonObject reply = new JsonObject(REPLY);
        String[] path = parts[0].substring(1).split("/");
        Object target = reply;
        for (int i = 0; i < path.length - 1; i++) {
            target = target instanceof JsonObject o ? o.getValue(path[i]) : ((io.vertx.core.json.JsonArray) target).getValue(Integer.parseInt(path[i]));
        }
        ((JsonObject) target).put(path[path.length - 1], new JsonObject("{\"v\":" + parts[1] + "}").getValue("v"));

        assertFalse(validator().validate(reply).getValid());
    }
}
