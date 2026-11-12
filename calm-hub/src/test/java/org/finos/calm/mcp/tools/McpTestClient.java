package org.finos.calm.mcp.tools;

import io.restassured.response.Response;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.util.concurrent.atomic.AtomicInteger;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

/** Calls /mcp over the streamable HTTP transport, as an MCP client does, in a new session for each call. */
final class McpTestClient {

    private static final AtomicInteger IDS = new AtomicInteger();

    private McpTestClient() {
    }

    static JsonArray listTools() {
        JsonArray tools = new JsonArray();
        String cursor = null;
        do {
            JsonObject params = cursor == null ? new JsonObject() : new JsonObject().put("cursor", cursor);
            JsonObject result = rpc("tools/list", params).getJsonObject("result");
            tools.addAll(result.getJsonArray("tools"));
            cursor = result.getString("nextCursor");
        } while (cursor != null);
        return tools;
    }

    static JsonObject callTool(String name, JsonObject arguments) {
        return rpc("tools/call", new JsonObject().put("name", name).put("arguments", arguments)).getJsonObject("result");
    }

    private static JsonObject rpc(String method, JsonObject params) {
        String session = initialize();
        Response response = post(session, new JsonObject().put("jsonrpc", "2.0").put("id", IDS.incrementAndGet())
                .put("method", method).put("params", params));
        assertThat(response.asString(), response.statusCode(), is(200));
        return body(response);
    }

    private static String initialize() {
        Response init = post(null, new JsonObject().put("jsonrpc", "2.0").put("id", IDS.incrementAndGet())
                .put("method", "initialize").put("params", new JsonObject()
                        .put("protocolVersion", "2025-06-18")
                        .put("capabilities", new JsonObject())
                        .put("clientInfo", new JsonObject().put("name", "test").put("version", "0"))));
        assertThat(init.asString(), init.statusCode(), is(200));
        String session = init.header("Mcp-Session-Id");
        post(session, new JsonObject().put("jsonrpc", "2.0").put("method", "notifications/initialized"));
        return session;
    }

    private static Response post(String session, JsonObject message) {
        var spec = given()
                .contentType("application/json")
                .accept("application/json, text/event-stream")
                .body(message.encode());
        if (session != null) {
            spec.header("Mcp-Session-Id", session);
        }
        return spec.post("/mcp");
    }

    // A streamable-HTTP reply is either JSON or an SSE stream whose last data line holds the JSON.
    private static JsonObject body(Response response) {
        String raw = response.asString();
        if (String.valueOf(response.contentType()).startsWith("text/event-stream")) {
            raw = raw.lines().filter(l -> l.startsWith("data:")).reduce((a, b) -> b)
                    .orElseThrow().substring("data:".length()).trim();
        }
        return new JsonObject(raw);
    }

    static JsonObject find(JsonArray tools, String name) {
        return tools.stream().map(JsonObject.class::cast).filter(t -> name.equals(t.getString("name")))
                .findFirst().orElseThrow();
    }

    static String text(JsonObject result) {
        return result.getJsonArray("content").getJsonObject(0).getString("text");
    }
}
