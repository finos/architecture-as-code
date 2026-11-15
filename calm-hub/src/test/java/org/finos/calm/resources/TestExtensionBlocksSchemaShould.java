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
