package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.extensions.ExtensionTestKeys;
import org.finos.calm.extensions.FixtureBackend;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
@TestProfile(TestExtensionProxyResourceReadOnlyShould.ReadOnlyProxyProfile.class)
class TestExtensionProxyResourceReadOnlyShould {

    private static final String BASE = "/api/calm/extensions/proxy-test/api";
    private static FixtureBackend backend;

    public static class ReadOnlyProxyProfile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.readonly", "true",
                    "calm.extensions.dir", "src/test/resources/extensions-test/proxy",
                    "calm.extensions.\"proxy-test\".backend-url", "http://localhost:" + FixtureBackend.freePort(),
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations", KEYS.publicKey().toString());
        }
    }

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
    void resetBackend() {
        backend.reset();
    }

    @Test
    @TestSecurity(user = "alice")
    void allow_a_post_to_a_read_only_route() {
        given().contentType("application/json").body("{\"q\":\"pay\"}")
                .when().post(BASE + "/search")
                .then().statusCode(200);

        assertThat(backend.received().body(), is("{\"q\":\"pay\"}"));
    }

    @Test
    @TestSecurity(user = "alice")
    void leave_a_post_with_no_slash_after_api_to_the_proxy() {
        // Not the read-only 405. JAX-RS gives the 404: the proxy resource needs a slash after "api".
        given().contentType("application/json").body("{}")
                .when().post(BASE)
                .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "alice")
    void list_only_the_methods_that_a_read_only_hub_accepts_on_a_method_mismatch() {
        given().when().delete(BASE + "/namespaces/finos/services")
                .then().statusCode(405)
                .header("Allow", "GET, HEAD")
                .body("error", equalTo("The extension route does not allow this method"));
        given().when().delete(BASE + "/search")
                .then().statusCode(405)
                .header("Allow", "POST");

        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void apply_the_same_path_rule_as_a_hub_that_is_not_read_only() {
        given().when().get(BASE + "/services/architectures")
                .then().statusCode(200);
        backend.reset();
        for (String value : new String[]{"architectures%2F1", "architectures%2f1", "architectures%252F1"}) {
            given().urlEncodingEnabled(false)
                    .when().get(BASE + "/services/" + value)
                    .then().statusCode(400);
        }

        assertThat(backend.received(), nullValue());
    }

    @Test
    @TestSecurity(user = "alice")
    void refuse_a_write_route_and_every_other_write() {
        given().contentType("application/json").body("{}")
                .when().post(BASE + "/namespaces/finos/services")
                .then().statusCode(405)
                .header("Allow", "GET, HEAD")
                .body("error", equalTo("This CALM Hub instance is read-only"));
        given().contentType("application/json").body("{}")
                .when().post("/api/calm/namespaces")
                .then().statusCode(405);
        given().contentType("application/json").body("{}").urlEncodingEnabled(false)
                .when().post(BASE + "/../../namespaces")
                .then().statusCode(405);

        assertThat(backend.received(), nullValue());
    }
}
