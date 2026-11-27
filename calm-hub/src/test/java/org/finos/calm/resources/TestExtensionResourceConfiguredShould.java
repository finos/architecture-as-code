package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.extensions.ExtensionTestKeys;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
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
                .body("values.id", contains("control-evaluation", "deployment", "example-services"))
                .body("values.find { it.id == 'example-services' }.version", equalTo("0.1.0"))
                .body("values.find { it.id == 'example-services' }.hubApi", equalTo(0))
                .body("values.find { it.id == 'example-services' }.routes.id", contains("screen", "namespace-services", "search", "add-service", "chat"))
                .body("values.find { it.id == 'example-services' }.routes[0].readOnly", equalTo(true))
                .body("values.find { it.id == 'example-services' }.routes[3].readOnly", equalTo(false))
                .body("values.find { it.id == 'example-services' }.commands.keySet()", contains("add-service", "list-services"))
                .body("values.find { it.id == 'example-services' }.commands.list-services.input.required", contains("namespace"))
                .body("values.find { it.id == 'example-services' }.commands.list-services.idempotent", equalTo(true))
                .body("values.find { it.id == 'example-services' }.contributes.screen[0].route", equalTo("screen"))
                .body("values.find { it.id == 'example-services' }.contributes.search-provider[0].route", equalTo("search"))
                .body("values.find { it.id == 'example-services' }.contributes.decorator-views[0].overlay.default", equalTo("info"))
                .body("values.find { it.id == 'example-services' }.contributes.keySet()", contains("screen", "search-provider", "chat", "decorator-views"))
                .body("values.find { it.id == 'example-services' }.contributes.chat[0].route", equalTo("chat"))
                .body("chat", nullValue())
                .body("values.find { it.id == 'example-services' }.contributes.decorator-views[0].overlay.keySet()", contains("status", "map", "default", "label"))
                .body("values.find { it.id == 'example-services' }.logo.light", equalTo("logo.svg"))
                .body("values.find { it.id == 'example-services' }.logo.keySet()", contains("light", "dark"))
                .body("values.find { it.id == 'example-services' }.keySet()", contains("id", "version", "hubApi", "name", "description", "provider",
                        "logo", "routes", "commands", "contributes"))
                .body("values.find { it.id == 'control-evaluation' }.keySet()", not(hasItem("logo")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"light", "dark"})
    @TestSecurity(user = "alice")
    void serve_each_logo_file_as_an_svg_image_that_cannot_run_or_be_sniffed(String variant) throws IOException {
        String file = variant.equals("light") ? "logo.svg" : "logo-dark.svg";
        byte[] expected = Files.readAllBytes(Path.of("local-dev/extensions/example-services", file));

        byte[] body = given()
                .when()
                .get("/api/calm/extensions/example-services/logo/" + variant)
                .then()
                .statusCode(200)
                .contentType("image/svg+xml")
                .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
                .header("X-Content-Type-Options", "nosniff")
                .header("Cache-Control", "private, no-cache")
                .header("ETag", matchesPattern("\"[0-9a-f]{16}\""))
                .extract().asByteArray();

        assertThat(body, equalTo(expected));
    }

    @Test
    @TestSecurity(user = "alice")
    void answer_a_logo_request_with_the_current_etag_with_304() {
        String etag = given().get("/api/calm/extensions/example-services/logo/light").then().statusCode(200)
                .extract().header("ETag");

        given()
                .header("If-None-Match", etag)
                .when()
                .get("/api/calm/extensions/example-services/logo/light")
                .then()
                .statusCode(304)
                .header("ETag", etag);
    }

    @ParameterizedTest
    @ValueSource(strings = {"unknown/logo/light", "control-evaluation/logo/light", "example-services/logo/blue",
            "example-services/logo/light.svg"})
    @TestSecurity(user = "alice")
    void give_404_for_a_logo_that_no_enabled_extension_declares(String path) {
        given()
                .when()
                .get("/api/calm/extensions/" + path)
                .then()
                .statusCode(404);
    }

    @Test
    void require_a_signed_in_user_for_a_logo() {
        given()
                .when()
                .get("/api/calm/extensions/example-services/logo/light")
                .then()
                .statusCode(401);
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
