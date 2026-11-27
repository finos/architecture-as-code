package org.finos.calm.resources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.restassured.RestAssured;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.extensions.ExtensionTestKeys;
import org.finos.calm.extensions.FixtureBackend;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.Test;

import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.emptyString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.oneOf;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
@TestProfile(TestExtensionProxyResourceShould.ProxyProfile.class)
class TestExtensionProxyResourceShould {

    static final String CSP = "sandbox; default-src 'none'";
    private static final String BASE = "/api/calm/extensions/proxy-test/api";
    private static final String CHAT = "/api/calm/extensions/proxy-test/chat/assistant";
    private static final String QUESTION = """
            {"conversationId":"c1","messageId":"m1","messages":[{"role":"user","content":"Which services?"}]}""";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static FixtureBackend backend;

    @InjectMock
    UserAccessStore mockUserAccessStore;

    public static class ProxyProfile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.extensions.dir", "src/test/resources/extensions-test/proxy",
                    "calm.extensions.chat-provider", "proxy-test",
                    "calm.extensions.\"proxy-test\".backend-url", "http://localhost:" + FixtureBackend.freePort() + "/base",
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations", KEYS.publicKey().toString());
        }
    }

    @BeforeAll
    static void startBackend() {
        // Read back from the running Hub: the profile can be loaded more than once, each time with a new port.
        String url = ConfigProvider.getConfig().getValue("calm.extensions.\"proxy-test\".backend-url", String.class);
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
    void proxy_a_declared_route_with_the_content_security_policy() {
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "application/json", "Set-Cookie", "a=b"),
                "{\"blocks\":[]}".getBytes(StandardCharsets.UTF_8), 0));

        given()
                .header("Cookie", "session=secret")
                .header("Remote-User", "mallory")
                .header("X-Forwarded-For", "10.0.0.1")
                .when()
                .get(BASE + "/screen?b=2&a=1")
                .then()
                .statusCode(200)
                .header("Content-Security-Policy", CSP)
                .header("Set-Cookie", nullValue())
                .header("X-Content-Type-Options", "nosniff")
                .body("blocks.size()", equalTo(0));

        FixtureBackend.Received received = backend.received();
        assertThat(received.pathAndQuery(), is("/base/screen?a=1&b=2"));
        assertThat(received.header("X-Calm-Hub-Identity"), notNullValue());
        assertThat(received.header("Cookie"), nullValue());
        assertThat(received.header("Remote-User"), nullValue());
        assertThat(received.header("X-Forwarded-For"), nullValue());
        assertThat(received.header("Authorization"), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_encoded_protected_literals_before_forwarding() {
        given().when().get(BASE + "/services/admin").then().statusCode(403);
        for (String path : new String[]{"/services/%61dmin", "/services/%61%64%6Din",
                "/%73ervices/admin", "/services/%2561dmin"}) {
            backend.reset();
            given().urlEncodingEnabled(false).when().get(BASE + path).then().statusCode(400);
            assertThat(backend.received(), nullValue());
        }
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_an_encoded_slash_in_a_path_parameter() {
        for (String value : new String[]{"team%2Fservice", "team%2fservice", "team%252Fservice", "team%25252fservice"}) {
            given().urlEncodingEnabled(false)
                    .when().get(BASE + "/services/" + value)
                    .then().statusCode(400);
        }
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_a_matrix_parameter_and_not_drop_it() {
        for (String path : new String[]{"/services/team;v=1", "/screen;x", "/services;v=1/team", "/screen;"}) {
            given().urlEncodingEnabled(false)
                    .when().get(BASE + path)
                    .then().statusCode(400).body("error", equalTo("The extension path or query is not allowed"));
        }
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_an_encoded_look_alike_of_a_slash_or_a_backslash() {
        for (String value : new String[]{"team%E2%88%95service", "team%EF%BC%8Fservice", "team%ef%bc%bcservice"}) {
            given().urlEncodingEnabled(false)
                    .when().get(BASE + "/services/" + value)
                    .then().statusCode(400).body("error", equalTo("The extension path or query is not allowed"));
        }
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void forward_an_encoded_parameter_and_bind_it_in_the_assertion() throws Exception {
        given().urlEncodingEnabled(false)
                .when().get(BASE + "/services/team%3Aservice")
                .then().statusCode(200);

        FixtureBackend.Received received = backend.received();
        assertThat(received.pathAndQuery(), is("/base/services/team%3Aservice"));
        String payload = received.header("X-Calm-Hub-Identity").split("\\.")[1];
        JsonNode claims = new ObjectMapper()
                .readTree(Base64.getUrlDecoder().decode(payload));
        assertThat(claims.get("route").asText(), is("service"));
        assertThat(claims.get("htp").asText(), is("/services/team%3Aservice"));
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_dot_segments_in_a_path_parameter_with_encoded_slashes() {
        for (String value : new String[]{"team%2F..%2Fadmin", "team%2f..%2fadmin", "team%2F%2E%2E%2Fadmin"}) {
            given().urlEncodingEnabled(false)
                    .when().get(BASE + "/services/" + value)
                    .then().statusCode(400);
        }
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void return_a_generic_json_error_with_the_policy() {
        given()
                .when()
                .get(BASE + "/not-declared")
                .then()
                .statusCode(404)
                .header("Content-Security-Policy", CSP)
                .body("error", equalTo("The extension has no such route"));

        given()
                .when()
                .get("/api/calm/extensions/missing/api/screen")
                .then()
                .statusCode(404)
                .body("error", equalTo("There is no such extension"));
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_an_encoded_path_that_could_leave_the_route() {
        for (String path : new String[]{"/%2e%2e/admin", "/screen%2f..%2fadmin", "/%252e%252e/admin", "/@evil.example.com"}) {
            int status = given()
                    .urlEncodingEnabled(false)
                    .when()
                    .get(BASE + path)
                    .then()
                    .extract().statusCode();

            assertThat(path, status, oneOf(400, 404));
        }
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void return_502_with_a_generic_body_when_the_backend_fails() {
        backend.reply(FixtureBackend.Reply.json(500, "{\"stack\":\"secret internals\"}"));

        given()
                .when()
                .get(BASE + "/screen")
                .then()
                .statusCode(502)
                .body("error", equalTo("The extension failed"));
    }

    @Test
    @TestSecurity(user = "alice")
    void check_the_namespace_scope_with_the_grants_of_the_caller() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.read, "finos")));

        given().when().get(BASE + "/namespaces/finos/services").then().statusCode(200);
        given().when().get(BASE + "/namespaces/other/services").then().statusCode(403)
                .body("error", equalTo("You do not have the scope that this extension route needs"));
        given().contentType("application/json").body("{}").when().post(BASE + "/namespaces/finos/services")
                .then().statusCode(403);
        given().when().get(BASE + "/admin").then().statusCode(403);
        given().when().head(BASE + "/namespaces/other/services").then().statusCode(403);
        given().when().head(BASE + "/admin").then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_put_patch_and_delete_on_a_route_that_declares_only_get() {
        given().contentType("application/json").body("{}").when().put(BASE + "/screen").then().statusCode(405);
        given().contentType("application/json").body("{}").when().patch(BASE + "/screen").then().statusCode(405);
        given().when().delete(BASE + "/screen").then().statusCode(405)
                .header("Allow", "GET, HEAD")
                .header("Content-Security-Policy", CSP)
                .body("error", equalTo("The extension route does not allow this method"));

        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void answer_head_with_the_get_route_because_allow_lists_head() {
        given().when().head(BASE + "/screen")
                .then().statusCode(200)
                .header("Content-Security-Policy", CSP);

        assertThat(backend.received().method(), is("GET"));
        assertThat(backend.received().pathAndQuery(), is("/base/screen"));
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_a_cross_site_form_post_before_signing() {
        given().contentType("text/plain").body("{\"q\":\"pay\"}")
                .when().post(BASE + "/search")
                .then().statusCode(415)
                .header("Content-Security-Policy", CSP)
                .header("Cache-Control", "private")
                .body("error", equalTo("The request must be JSON"));

        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_a_post_with_no_content_type() throws Exception {
        // RestAssured always sends a Content-Type with a body, so this uses the JDK client.
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + RestAssured.port + BASE + "/search"))
                .POST(HttpRequest.BodyPublishers.ofString("{\"q\":\"pay\"}"))
                .build();

        HttpResponse<String> response;
        try (HttpClient client = HttpClient.newHttpClient()) {
            response = client.send(request, HttpResponse.BodyHandlers.ofString());
        }

        assertThat(request.headers().firstValue("Content-Type").isPresent(), is(false));
        assertThat(response.statusCode(), is(415));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void accept_a_caller_that_accepts_only_an_event_stream_or_problem_json() {
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "text/event-stream"),
                "data: hello\n\n".getBytes(StandardCharsets.UTF_8), 0));
        given().accept("text/event-stream").when().get(BASE + "/screen")
                .then().statusCode(200)
                .contentType("text/event-stream")
                .body(equalTo("data: hello\n\n"));

        backend.reply(new FixtureBackend.Reply(409, Map.of("Content-Type", "application/problem+json"),
                "{\"title\":\"Name is taken\"}".getBytes(StandardCharsets.UTF_8), 0));
        given().accept("application/problem+json").when().get(BASE + "/screen")
                .then().statusCode(409)
                .contentType("application/problem+json");

        given().accept("text/event-stream").when().get(BASE + "/not-declared")
                .then().statusCode(404)
                .contentType("application/json")
                .body("error", equalTo("The extension has no such route"));
    }

    @Test
    @TestSecurity(user = "alice")
    void answer_head_on_an_event_stream_with_its_headers_and_free_its_stream_slot() {
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "text/event-stream"),
                "data: hello\n\n".getBytes(StandardCharsets.UTF_8), 0));
        // One more HEAD than the default max-concurrent-streams (8): a HEAD that kept its slot would make the last 503.
        for (int i = 0; i <= 8; i++) {
            given().accept("text/event-stream").when().head(BASE + "/screen")
                    .then().statusCode(200)
                    .contentType("text/event-stream")
                    .header("Content-Security-Policy", CSP)
                    .body(emptyString());
        }
        assertThat(backend.received().method(), is("GET"));

        given().accept("text/event-stream").when().get(BASE + "/screen")
                .then().statusCode(200)
                .body(equalTo("data: hello\n\n"));

        // HEAD has the access checks of GET: the chat route is POST only, and an undeclared route does not exist.
        backend.reset();
        for (String path : new String[]{"/chat", "/not-declared"}) {
            int status = given().accept("text/event-stream").when().get(BASE + path).then().extract().statusCode();
            assertThat(status, oneOf(404, 405));
            given().accept("text/event-stream").when().head(BASE + path).then().statusCode(status);
        }
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void buffer_a_2xx_event_stream_reply_other_than_200_and_refuse_it_on_the_chat_endpoint() {
        backend.reply(new FixtureBackend.Reply(204, Map.of("Content-Type", "text/event-stream"), new byte[0], 0));
        // One more than the default max-concurrent-streams (8): a 204 that kept its stream slot would make the last 503.
        for (int i = 0; i <= 8; i++) {
            given().accept("text/event-stream").when().get(BASE + "/screen").then().statusCode(204);
        }
        given().contentType("application/json").body(QUESTION).when().post(CHAT)
                .then().statusCode(502)
                .body("error", equalTo("The extension failed"));

        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "text/event-stream"),
                "data: hello\n\n".getBytes(StandardCharsets.UTF_8), 0));
        given().accept("text/event-stream").when().get(BASE + "/screen")
                .then().statusCode(200)
                .body(equalTo("data: hello\n\n"));
    }

    @Test
    @TestSecurity(user = "alice")
    void free_a_proxy_stream_and_cancel_its_backend_call_when_a_response_filter_fails() throws Exception {
        failEachStreamOfAFullPool(() -> given().accept("text/event-stream").header(FaultyResponseFilter.FAIL, "true")
                .when().get(BASE + "/screen").then().statusCode(500));

        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "text/event-stream"),
                "data: hello\n\n".getBytes(StandardCharsets.UTF_8), 0));
        given().accept("text/event-stream").when().get(BASE + "/screen")
                .then().statusCode(200)
                .body(equalTo("data: hello\n\n"));
    }

    @Test
    @TestSecurity(user = "alice")
    void free_a_chat_stream_and_cancel_its_backend_call_when_a_response_filter_fails() throws Exception {
        failEachStreamOfAFullPool(() -> given().contentType("application/json").header(FaultyResponseFilter.FAIL, "true")
                .body(QUESTION).when().post(CHAT).then().statusCode(500));

        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "text/event-stream"),
                "event: done\ndata: {}\n\n".getBytes(StandardCharsets.UTF_8), 0));
        given().contentType("application/json").body(QUESTION).when().post(CHAT)
                .then().statusCode(200)
                .body(equalTo("event: done\ndata: {}\n\n"));
    }

    @Test
    @TestSecurity(user = "alice")
    void free_the_stream_slot_when_the_caller_leaves_before_the_backend_replies_and_a_response_filter_fails()
            throws Exception {
        // As many as the default max-concurrent-streams (8): the exchange has ended before the reply arrives.
        for (int i = 0; i < 8; i++) {
            backend.reset();
            FaultyResponseFilter.EXCHANGE.set(null);
            CountDownLatch headers = new CountDownLatch(1);
            backend.holdHeaders(headers);
            backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "text/event-stream"),
                    "data: hello\n\n".getBytes(StandardCharsets.UTF_8), 0));
            int failed = FaultyResponseFilter.FAILED.get();
            try {
                try (Socket socket = new Socket("localhost", RestAssured.port)) {
                    // A reset, so that Hub sees the connection end at once.
                    socket.setSoLinger(true, 0);
                    socket.getOutputStream().write(("GET " + BASE + "/screen HTTP/1.1\r\nHost: localhost\r\n"
                            + "Accept: text/event-stream\r\n" + FaultyResponseFilter.FAIL + ": true\r\n\r\n")
                            .getBytes(StandardCharsets.US_ASCII));
                    socket.getOutputStream().flush();
                    waitFor(() -> backend.received() != null);
                }
                // Hub has seen the caller leave before the backend sends its headers.
                waitFor(() -> FaultyResponseFilter.EXCHANGE.get() != null
                        && FaultyResponseFilter.EXCHANGE.get().response().closed());
            } finally {
                headers.countDown();
            }
            waitFor(() -> FaultyResponseFilter.FAILED.get() > failed);
        }

        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "text/event-stream"),
                "data: hello\n\n".getBytes(StandardCharsets.UTF_8), 0));
        given().accept("text/event-stream").when().get(BASE + "/screen")
                .then().statusCode(200)
                .body(equalTo("data: hello\n\n"));
    }

    /**
     * Fills a stream pool of the default size (8, as max-concurrent-streams and max-concurrent-chat-streams) with
     * streams that a failed response filter stops JAX-RS from writing, while the backend holds each one open. Each
     * must cancel its backend call, not only free its slot.
     */
    private static void failEachStreamOfAFullPool(Runnable failedCall) throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        backend.stream(FixtureBackend.Stream.untilClosed("event: delta\ndata: {\"text\":\"Hel\"}\n\n",
                "data: " + "x".repeat(1000) + "\n\n", gate));
        try {
            for (int i = 0; i < 8; i++) {
                failedCall.run();
            }
        } finally {
            gate.countDown();
        }
        waitFor(() -> backend.brokenStreams() == 8);
        assertThat(backend.brokenStreams(), is(8));
    }

    private static void waitFor(BooleanSupplier condition) throws InterruptedException {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!condition.getAsBoolean() && System.nanoTime() < end) {
            Thread.sleep(10);
        }
        assertThat(condition.getAsBoolean(), is(true));
    }

    @Test
    @TestSecurity(user = "alice")
    void stream_each_chat_event_before_the_backend_ends_the_reply() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        backend.stream(new FixtureBackend.Stream(200, "text/event-stream", List.of(
                "id: 7\nevent: delta\ndata: {\"text\":\"Hel\"}\n\n",
                "event: delta\ndata: {\"text\":\"lo\"}\n\nevent: done\ndata: {}\n\n"), gate));
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + RestAssured.port + CHAT))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(QUESTION))
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<java.util.stream.Stream<String>> response = client.send(request, HttpResponse.BodyHandlers.ofLines());
        // A failed assertion must not wait for the open stream, so the test ends the client at once.
        try (java.util.stream.Stream<String> body = response.body()) {
            java.util.Iterator<String> lines = body.iterator();

            assertThat(response.statusCode(), is(200));
            assertThat(response.headers().firstValue("Content-Type").orElseThrow(), startsWith("text/event-stream"));
            assertThat(response.headers().firstValue("Cache-Control").orElseThrow(), is("private, no-store"));
            assertThat(response.headers().firstValue("Content-Security-Policy").orElseThrow(), is(CSP));
            // The first event arrives while the backend still holds the rest of the reply.
            assertThat(lines.next(), is("event: delta"));
            assertThat(lines.next(), is("data: {\"text\":\"Hel\"}"));
            gate.countDown();
            StringBuilder rest = new StringBuilder();
            lines.forEachRemaining(line -> rest.append(line).append('\n'));
            assertThat(rest.toString(), is("\nevent: delta\ndata: {\"text\":\"lo\"}\n\nevent: done\ndata: {}\n\n"));
        } finally {
            gate.countDown();
            client.shutdownNow();
        }
        assertThat(MAPPER.readTree(backend.received().body()).get("hubApi").asInt(), is(0));
        assertThat(backend.received().header("Accept"), is("text/event-stream"));
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_a_chat_route_on_the_generic_proxy_and_a_chat_message_that_is_not_valid() {
        given().contentType("application/json").body(QUESTION).when().post(BASE + "/chat")
                .then().statusCode(404)
                .body("error", equalTo("Call this extension route through its CALM Hub endpoint"));
        given().contentType("application/json").body("{\"messages\":[]}").when().post(CHAT)
                .then().statusCode(400)
                .contentType("application/json")
                .header("Content-Security-Policy", CSP);
        given().contentType("application/json").body(QUESTION).when().post("/api/calm/extensions/proxy-test/chat/other")
                .then().statusCode(404);
        assertThat(backend.received(), nullValue());
    }

    @Test
    void refuse_a_chat_message_from_an_anonymous_caller() {
        given().contentType("application/json").body(QUESTION).when().post(CHAT).then().statusCode(401);
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void list_the_chat_that_the_operator_chose() {
        given().when().get("/api/calm/extensions")
                .then().statusCode(200)
                .body("chat.extension", equalTo("proxy-test"))
                .body("chat.contribution", equalTo("assistant"))
                .body("values.find { it.id == 'proxy-test' }.contributes.chat[0].title", equalTo("Ask Atlas"));
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_an_empty_post_that_is_not_json_and_forward_an_empty_json_post() {
        for (String type : new String[]{"text/plain", "application/x-www-form-urlencoded"}) {
            given().contentType(type).when().post(BASE + "/search").then().statusCode(415);
        }
        assertThat(backend.received(), nullValue());

        given().contentType("application/json").when().post(BASE + "/search").then().statusCode(200);
        assertThat(backend.received(), notNullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void forward_a_json_post_and_bind_its_body() throws Exception {
        given().contentType("application/json").body("{\"q\":\"pay\"}")
                .when().post(BASE + "/search")
                .then().statusCode(200);

        String payload = backend.received().header("X-Calm-Hub-Identity").split("\\.")[1];
        JsonNode claims = new ObjectMapper().readTree(Base64.getUrlDecoder().decode(payload));
        assertThat(claims.get("bdh"), notNullValue());
        assertThat(claims.has("ns"), is(false));
    }

    @Test
    @TestSecurity(user = "alice")
    void pass_on_a_problem_json_client_error_as_a_private_reply() {
        backend.reply(new FixtureBackend.Reply(409, Map.of("Content-Type", "application/problem+json",
                "Cache-Control", "public, max-age=60"),
                "{\"title\":\"Name is taken\"}".getBytes(StandardCharsets.UTF_8), 0));

        given().when().get(BASE + "/screen")
                .then().statusCode(409)
                .contentType("application/problem+json")
                .header("Cache-Control", "private, max-age=60")
                .body(equalTo("{\"title\":\"Name is taken\"}"));
    }

    @Test
    void return_401_when_not_authenticated() {
        given()
                .when()
                .get(BASE + "/screen")
                .then()
                .statusCode(401);
        given().accept("text/event-stream").when().head(BASE + "/screen").then().statusCode(401);

        assertThat(backend.received(), nullValue());
    }
}
