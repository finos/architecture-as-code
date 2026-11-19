package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.extensions.ExtensionSearch;
import org.finos.calm.extensions.ExtensionTestKeys;
import org.finos.calm.extensions.FixtureBackend;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.when;

@QuarkusTest
@TestProfile(TestExtensionSearchResourceShould.SearchProfile.class)
class TestExtensionSearchResourceShould {

    private static final String SEARCH = "/api/calm/extensions/search-test/search/records";
    private static FixtureBackend backend;

    @InjectMock
    UserAccessStore mockUserAccessStore;

    public static class SearchProfile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.extensions.dir", "src/test/resources/extensions-test/search",
                    "calm.extensions.\"search-test\".backend-url", "http://localhost:" + FixtureBackend.freePort() + "/base",
                    "calm.extensions.\"search-test\".request-timeout-seconds", "1",
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations", KEYS.publicKey().toString());
        }
    }

    @BeforeAll
    static void startBackend() {
        String url = ConfigProvider.getConfig().getValue("calm.extensions.\"search-test\".backend-url", String.class);
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
    void return_only_the_results_in_the_namespaces_that_the_caller_can_read() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.read, "finos")));
        backend.reply(FixtureBackend.Reply.json(200, """
                {"hubApi":0,"next":"2","results":[
                  {"id":"1","title":"Payments review","namespace":"finos"},
                  {"id":"2","title":"Merger review","namespace":"mergers"},
                  {"id":"3","title":"Runbook","link":{"href":"https://example.org/runbook"}}
                ]}"""));

        String body = given()
                .when().get(SEARCH + "?q=review&cursor=1")
                .then().statusCode(200)
                .header("Cache-Control", "private, no-store")
                .body("results.title", contains("Payments review", "Runbook"))
                .body("next", equalTo("2"))
                .extract().asString();

        assertThat(body, not(containsString("Merger")));
        assertThat(backend.received().pathAndQuery(), is("/base/search"));
        assertThat(backend.received().body(), is("{\"hubApi\":0,\"query\":\"review\",\"limit\":10,\"cursor\":\"1\"}"));
    }

    @Test
    @TestSecurity(user = "alice")
    void send_back_each_cursor_that_it_accepts_and_refuse_a_reply_whose_cursor_does_not_fit() {
        // Cursors that make the request for the next page, with the path and the query, exactly as long as Hub allows.
        int room = ExtensionSearch.MAX_REQUEST_LINE - requestLine("");
        String ascii = "a".repeat(room);
        String unicode = "𝄞".repeat(room / 12) + "a".repeat(room % 12);
        for (String cursor : new String[]{ascii, unicode}) {
            backend.reply(FixtureBackend.Reply.json(200, page(cursor)));
            String next = given().when().get(SEARCH + "?q=payments")
                    .then().statusCode(200).extract().path("next");
            assertThat(next, is(cursor));
            assertThat(requestLine(next), is(ExtensionSearch.MAX_REQUEST_LINE));

            backend.reply(FixtureBackend.Reply.json(200, "{\"hubApi\":0,\"results\":[]}"));
            given().urlEncodingEnabled(false).when().get(nextPage(next)).then().statusCode(200);
            assertThat(backend.received().body(), containsString("\"cursor\":\"" + cursor + "\""));
        }
        // One byte more, or one character outside ASCII more, and Hub refuses the whole page: it does not cut it short.
        for (String cursor : new String[]{ascii + "a", unicode + "𝄞", "𝄞".repeat(512)}) {
            backend.reply(FixtureBackend.Reply.json(200, page(cursor)));
            given().when().get(SEARCH + "?q=payments")
                    .then().statusCode(502)
                    .body("error", equalTo("The search provider sent a cursor that is too long to send back"));
        }
        // A request that does not fit gets 400 from Hub, not 414 from the server, and does not reach the provider.
        backend.reset();
        given().urlEncodingEnabled(false).when().get(nextPage(ascii + "a"))
                .then().statusCode(400)
                .body("error", equalTo("The query and the cursor are too long"));
        assertThat(backend.received(), nullValue());
    }

    private static String page(String next) {
        return "{\"hubApi\":0,\"results\":[{\"id\":\"a\",\"title\":\"Visible\"}],\"next\":\"" + next + "\"}";
    }

    private static String nextPage(String cursor) {
        return SEARCH + "?q=payments&cursor=" + URLEncoder.encode(cursor, StandardCharsets.UTF_8);
    }

    private static int requestLine(String cursor) {
        return ("GET " + nextPage(cursor) + " HTTP/1.1").getBytes(StandardCharsets.UTF_8).length;
    }

    @Test
    void refuse_a_caller_who_is_not_signed_in() {
        given().when().get(SEARCH + "?q=review").then().statusCode(401);
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_an_unknown_provider_and_a_missing_query_with_a_generic_error() {
        given().when().get("/api/calm/extensions/search-test/search/other?q=review")
                .then().statusCode(404)
                .body("error", equalTo("There is no such search provider"));
        given().when().get(SEARCH)
                .then().statusCode(400)
                .body("error", containsString("The query must have 1 to 200 characters"));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_the_provider_route_on_the_generic_proxy() {
        given().contentType("application/json").body("{\"hubApi\":0,\"query\":\"review\",\"limit\":10}")
                .when().post("/api/calm/extensions/search-test/api/search")
                .then().statusCode(404)
                .body("error", equalTo("Call this extension route through its CALM Hub endpoint"));
        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void time_out_a_slow_provider_and_name_no_backend() {
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "application/json"),
                "{\"hubApi\":0,\"results\":[]}".getBytes(StandardCharsets.UTF_8), 2500));

        given().when().get(SEARCH + "?q=review")
                .then().statusCode(504)
                .header("Cache-Control", "private, no-store")
                .body("error", equalTo("The extension did not reply in time"))
                .body(not(containsString("localhost")));
    }
}
