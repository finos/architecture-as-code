package org.finos.calm.resources;

import io.vertx.core.json.JsonObject;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchema;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TestExtensionBlocksSchemaShould {
    private Validator validator() throws Exception {
        try (var stream = getClass().getResourceAsStream("/META-INF/calm-extensions/schema/0/blocks.schema.json")) {
            var json = new JsonObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            return Validator.create(JsonSchema.of(json), new JsonSchemaOptions()
                    .setDraft(Draft.DRAFT202012).setBaseUri(json.getString("$id")));
        }
    }

    @Test
    void accept_all_seven_block_types() throws Exception {
        var reply = new JsonObject("""
                {"hubApi":0,"blocks":[
                  {"type":"markdown","text":"hello"},
                  {"type":"keyValue","items":[{"label":"count","value":1}]},
                  {"type":"stats","items":[{"label":"count","value":"one"}]},
                  {"type":"table","columns":["name"],"rows":[["x",1,{"badge":"ok","tone":"positive"}]]},
                  {"type":"cards","items":[{"title":"card","link":{"label":"Hub","hub":{"namespace":"test","type":"architectures","id":"1","version":"1.0.0"}}}]},
                  {"type":"alert","text":"notice","tone":"warning"},
                  {"type":"links","items":[{"label":"site","href":"https://example.com"}]}
                ]}
                """);
        assertTrue(validator().validate(reply).getValid());
    }

    @Test
    void accept_typed_destinations_with_context_and_view_state() throws Exception {
        var reply = new JsonObject("""
                {"hubApi":0,"blocks":[{"type":"links","items":[
                  {"label":"Node","hub":{"namespace":"a","type":"architectures","id":"1","version":"1.0.0","element":"api","extension":"reviews"}},
                  {"label":"Reviews","screen":{"extension":"reviews","screen":"list",
                    "context":{"namespace":"a","type":"architectures","id":"1","version":"1.0.0","element":"api"},
                    "params":{"sort":"due","reviews.filter":"needs-review","reviews.q":"pay","reviews.page":"10000"}}},
                  {"label":"Bare screen","screen":{"extension":"reviews","screen":"list"}}
                ]}]}
                """);
        assertTrue(validator().validate(reply).getValid());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            // Two kinds in one link.
            "{\"label\":\"x\",\"href\":\"https://example.com\",\"screen\":{\"extension\":\"e\",\"screen\":\"s\"}}",
            // A dot segment, or a missing version.
            "{\"label\":\"x\",\"hub\":{\"namespace\":\"a\",\"type\":\"architectures\",\"id\":\"..\",\"version\":\"1\"}}",
            "{\"label\":\"x\",\"hub\":{\"namespace\":\"a\",\"type\":\"architectures\",\"id\":\"1\"}}",
            // An arbitrary internal URL is not a destination.
            "{\"label\":\"x\",\"hub\":{\"namespace\":\"a\",\"type\":\"architectures\",\"id\":\"1\",\"version\":\"1\",\"path\":\"/admin\"}}",
            "{\"label\":\"x\",\"screen\":{\"extension\":\"Bad\",\"screen\":\"s\"}}",
            "{\"label\":\"x\",\"screen\":{\"extension\":\"e\",\"screen\":\"s\",\"context\":{\"namespace\":\"a\"}}}",
            // A context name, a page out of range, or an unknown table key.
            "{\"label\":\"x\",\"screen\":{\"extension\":\"e\",\"screen\":\"s\",\"params\":{\"namespace\":\"b\"}}}",
            "{\"label\":\"x\",\"screen\":{\"extension\":\"e\",\"screen\":\"s\",\"params\":{\"t.page\":\"1\"}}}",
            "{\"label\":\"x\",\"screen\":{\"extension\":\"e\",\"screen\":\"s\",\"params\":{\"t.page\":\"10001\"}}}",
            "{\"label\":\"x\",\"screen\":{\"extension\":\"e\",\"screen\":\"s\",\"params\":{\"t.sort\":\"a\"}}}"
    })
    void reject_invalid_destinations(String link) throws Exception {
        var reply = new JsonObject("{\"hubApi\":0,\"blocks\":[{\"type\":\"links\",\"items\":[" + link + "]}]}");
        assertFalse(validator().validate(reply).getValid());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"hubApi\":1,\"blocks\":[]}",
            "{\"hubApi\":0,\"blocks\":[{\"type\":\"unknown\"}]}",
            "{\"hubApi\":0,\"blocks\":[{\"type\":\"markdown\"}]}",
            "{\"hubApi\":0,\"blocks\":[{\"type\":\"links\",\"items\":[{\"label\":\"x\",\"href\":\"javascript:alert(1)\"}]}]}",
            "{\"hubApi\":0,\"blocks\":[{\"type\":\"alert\",\"text\":\"x\",\"tone\":\"evil\"}]}"
    })
    void reject_invalid_replies(String reply) throws Exception {
        assertFalse(validator().validate(new JsonObject(reply)).getValid());
    }

    @Test
    void accept_stat_filters_and_filterable_tables() throws Exception {
        var reply = new JsonObject("""
                {"hubApi":0,"blocks":[
                  {"type":"stats","items":[
                    {"label":"All","value":5,"filter":{"table":"reviews"}},
                    {"label":"Needs review","value":2,"filter":{"table":"reviews","id":"needs-review","column":"Status","value":"Needs review"}},
                    {"label":"Failed","value":7,"filter":{"table":"deploys","id":"failed"}},
                    {"label":"Mean age","value":"4 days"}
                  ]},
                  {"type":"table","id":"reviews","columns":["Name","Status"],"rows":[["a","b"]],
                   "search":{"label":"Filter by name","columns":["Name"]}},
                  {"type":"table","id":"deploys","columns":["Name"],"rows":[],"source":{"route":"deploy-rows","pageSize":50}}
                ]}
                """);
        assertTrue(validator().validate(reply).getValid());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"type\":\"stats\",\"items\":[{\"label\":\"x\",\"value\":1,\"filter\":{\"id\":\"a\"}}]}",
            "{\"type\":\"stats\",\"items\":[{\"label\":\"x\",\"value\":1,\"filter\":{\"table\":\"t\",\"id\":\"a\",\"column\":\"Status\"}}]}",
            "{\"type\":\"stats\",\"items\":[{\"label\":\"x\",\"value\":1,\"filter\":{\"table\":\"t\",\"column\":\"Status\",\"value\":\"x\"}}]}",
            "{\"type\":\"stats\",\"items\":[{\"label\":\"x\",\"value\":1,\"filter\":{\"table\":\"t\",\"id\":\"\"}}]}",
            "{\"type\":\"table\",\"id\":\"Reviews\",\"columns\":[],\"rows\":[]}",
            "{\"type\":\"table\",\"columns\":[],\"rows\":[],\"source\":{\"route\":\"rows\",\"pageSize\":0}}",
            "{\"type\":\"table\",\"columns\":[],\"rows\":[],\"source\":{\"pageSize\":10}}"
    })
    void reject_invalid_filters(String block) throws Exception {
        assertFalse(validator().validate(new JsonObject("{\"hubApi\":0,\"blocks\":[" + block + "]}")).getValid());
    }

    @Test
    void define_the_reply_of_a_table_source_route() throws Exception {
        try (var stream = getClass().getResourceAsStream("/META-INF/calm-extensions/schema/0/blocks.schema.json")) {
            var json = new JsonObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            var rows = Validator.create(JsonSchema.of(new JsonObject()
                    .put("$ref", "#/$defs/tableRowsReply").put("$defs", json.getJsonObject("$defs"))),
                    new JsonSchemaOptions().setDraft(Draft.DRAFT202012).setBaseUri(json.getString("$id")));
            assertTrue(rows.validate(new JsonObject("{\"hubApi\":0,\"rows\":[[\"a\",1,{\"badge\":\"ok\"}]],\"total\":12}")).getValid());
            assertFalse(rows.validate(new JsonObject("{\"hubApi\":0,\"rows\":[]}")).getValid());
            assertFalse(rows.validate(new JsonObject("{\"hubApi\":0,\"rows\":[],\"total\":-1}")).getValid());
        }
    }

    @Test
    void return_a_server_error_if_the_packaged_schema_is_missing() throws Exception {
        assertEquals(500, ExtensionResource.schemaResponse(null).getStatus());
    }

    @Test
    void close_the_schema_stream_when_reading_fails() {
        AtomicBoolean closed = new AtomicBoolean();
        InputStream stream = new InputStream() {
            @Override
            public int read() throws IOException {
                throw new IOException("Cannot read schema");
            }

            @Override
            public void close() {
                closed.set(true);
            }
        };
        assertThrows(IOException.class, () -> ExtensionResource.schemaResponse(stream));
        assertTrue(closed.get());
    }
}
