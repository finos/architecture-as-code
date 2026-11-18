package org.finos.calm.resources;

import io.vertx.core.json.JsonObject;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchema;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;

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

    @ParameterizedTest
    @ValueSource(strings = {
            "/graph/nodes/1/link|{\"href\":\"javascript:alert(1)\"}",
            "/graph/nodes/1/link|{\"params\":{\"a\":\"b\"},\"href\":\"https://example.org\"}",
            "/graph/nodes/0/style|\"Person\"",
            "/kind|\"sequence\"",
            "/graph/nodes/0/html|\"<b>x</b>\""})
    void reject_a_reply_outside_the_contract(String change) throws Exception {
        String[] parts = change.split("\\|", 2);
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
