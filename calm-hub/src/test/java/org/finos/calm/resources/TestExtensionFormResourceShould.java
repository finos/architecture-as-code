package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.extensions.FixtureBackend;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.when;

@QuarkusTest
@TestProfile(TestExtensionProxyResourceShould.ProxyProfile.class)
class TestExtensionFormResourceShould {

    private static final String FORM = "/api/calm/extensions/proxy-test/forms/request-review";
    private static final String DISPATCH = "Calm-Extension-Dispatch";
    private static final String SUBMISSION = "{\"submission\":\"3f1beb2b-bded-4fda-96cc-1af7192f24b6\","
            + "\"context\":{\"namespace\":\"finos\",\"resourceType\":\"architectures\",\"resourceId\":\"1\",\"version\":\"1.0.0\"},"
            + "\"input\":{\"note\":\"%s\"}}";
    private static FixtureBackend backend;

    @InjectMock
    UserAccessStore mockUserAccessStore;

    @BeforeAll
    static void startBackend() {
        String url = ConfigProvider.getConfig().getValue("calm.extensions.\"proxy-test\".backend-url", String.class);
        backend = new FixtureBackend(URI.create(url).getPort());
    }

    @AfterAll
    static void stopBackend() {
        backend.close();
    }

    @BeforeEach
    void setup() {
        backend.reset();
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.write, "finos")));
    }

    @Test
    @TestSecurity(user = "alice")
    void pass_on_the_backend_reply_and_say_that_it_was_sent() {
        backend.reply(new FixtureBackend.Reply(201, Map.of("Content-Type", "application/json", DISPATCH, "not-sent"),
                "{\"message\":\"Saved\"}".getBytes(StandardCharsets.UTF_8), 0));

        given().contentType("application/json").body(SUBMISSION.formatted("Check the ledger"))
                .when().post(FORM)
                .then().statusCode(201)
                .header(DISPATCH, "sent")
                .header("Content-Security-Policy", TestExtensionProxyResourceShould.CSP)
                .body("message", equalTo("Saved"));

        assertThat(backend.received().pathAndQuery(), equalTo("/base/namespaces/finos/reviews"));
    }

    @Test
    @TestSecurity(user = "alice")
    void return_the_field_errors_without_sending() {
        given().contentType("application/json").body(SUBMISSION.formatted(""))
                .when().post(FORM)
                .then().statusCode(422)
                .header(DISPATCH, "not-sent")
                .body("error", equalTo("Check the values in the form"))
                .body("fields.note", equalTo("Enter a value."));

        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void say_that_a_refusal_by_hub_was_not_sent() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.read, "finos")));

        given().contentType("application/json").body(SUBMISSION.formatted("Check the ledger"))
                .when().post(FORM)
                .then().statusCode(403)
                .header(DISPATCH, "not-sent");
        given().contentType("application/json").body("{}")
                .when().post("/api/calm/extensions/proxy-test/forms/missing")
                .then().statusCode(404)
                .header(DISPATCH, "not-sent");

        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void say_that_the_outcome_is_unknown_when_the_backend_failed_after_it_got_the_call() {
        backend.reply(FixtureBackend.Reply.json(503, "{\"error\":\"The extension is busy. Try again later\"}"));

        given().contentType("application/json").body(SUBMISSION.formatted("Check the ledger"))
                .when().post(FORM)
                .then().statusCode(502)
                .header(DISPATCH, "unknown")
                .body("error", equalTo("The extension failed"));
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_the_form_route_through_the_generic_proxy() {
        given().contentType("application/json").body("{\"note\":\"anything\"}")
                .when().post("/api/calm/extensions/proxy-test/api/namespaces/finos/reviews")
                .then().statusCode(404)
                .body("error", containsString("through its CALM Hub endpoint"));

        assertThat(backend.received(), nullValue());
    }

    @Test
    void return_401_when_not_authenticated() {
        given().contentType("application/json").body(SUBMISSION.formatted("Check the ledger"))
                .when().post(FORM)
                .then().statusCode(401);

        assertThat(backend.received(), nullValue());
    }
}
