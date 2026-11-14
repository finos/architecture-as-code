package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.extensions.ExtensionTestKeys;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;

@QuarkusTest
@TestProfile(TestExtensionResourceConfiguredShould.ExtensionsConfiguredProfile.class)
class TestExtensionResourceConfiguredShould {

    static final String BACKEND_URL = "http://localhost:8091/backend-secret-path";

    public static class ExtensionsConfiguredProfile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.extensions.dir", "local-dev/extensions",
                    "calm.extensions.\"example-services\".backend-url", BACKEND_URL,
                    // The static settings must not clash with the settings of each extension.
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations", KEYS.publicKey().toString(),
                    "calm.extensions.http.connect-timeout-seconds", "3");
        }
    }

    @Test
    @TestSecurity(user = "alice")
    void list_the_enabled_extensions_with_their_routes_commands_and_contributions() {
        given()
                .when()
                .get("/api/calm/extensions")
                .then()
                .statusCode(200)
                .body("values.id", contains("example-services"))
                .body("values[0].version", equalTo("0.1.0"))
                .body("values[0].hubApi", equalTo(0))
                .body("values[0].routes.id", contains("screen", "namespace-services", "search", "add-service"))
                .body("values[0].routes[0].readOnly", equalTo(true))
                .body("values[0].routes[3].readOnly", equalTo(false))
                .body("values[0].commands.keySet()", contains("add-service", "list-services"))
                .body("values[0].commands.list-services.input.required", contains("namespace"))
                .body("values[0].commands.list-services.idempotent", equalTo(true))
                .body("values[0].contributes.screen[0].route", equalTo("screen"))
                .body("values[0].contributes.search-provider[0].route", equalTo("search"))
                .body("values[0].contributes.decorator-views[0].overlay.default", equalTo("info"))
                .body("values[0].contributes.keySet()", contains("screen", "search-provider", "decorator-views"))
                .body("values[0].contributes.decorator-views[0].overlay.keySet()", contains("status", "map", "default", "label"))
                .body("values[0].keySet()", contains("id", "version", "hubApi", "name", "description", "provider",
                        "routes", "commands", "contributes"));
    }

    @Test
    @TestSecurity(user = "alice")
    void leave_out_the_backend_url() {
        given()
                .when()
                .get("/api/calm/extensions")
                .then()
                .statusCode(200)
                .body(not(containsString("backend-secret-path")))
                .body(not(containsString("localhost:8091")));
    }
}
