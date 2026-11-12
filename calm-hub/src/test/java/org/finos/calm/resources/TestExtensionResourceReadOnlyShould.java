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

@QuarkusTest
@TestProfile(TestExtensionResourceReadOnlyShould.ReadOnlyExtensionsProfile.class)
class TestExtensionResourceReadOnlyShould {

    public static class ReadOnlyExtensionsProfile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.readonly", "true",
                    "calm.extensions.dir", "local-dev/extensions",
                    "calm.extensions.example-services.backend-url", "http://localhost:8091",
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations", KEYS.publicKey().toString());
        }
    }

    @Test
    @TestSecurity(user = "alice")
    void leave_out_write_routes_and_their_commands() {
        given()
                .when()
                .get("/api/calm/extensions")
                .then()
                .statusCode(200)
                .body("values.id", contains("control-evaluation", "deployment", "example-services"))
                .body("values[0].contributes.decorator-views.id", contains("control-evaluation"))
                .body("values.find { it.id == 'example-services' }.routes.id", contains("screen", "namespace-services", "search"))
                .body("values.find { it.id == 'example-services' }.commands.keySet()", contains("list-services"));
    }
}
