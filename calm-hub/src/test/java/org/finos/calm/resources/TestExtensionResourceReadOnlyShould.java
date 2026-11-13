package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;

@QuarkusTest
@TestProfile(TestExtensionResourceReadOnlyShould.ReadOnlyExtensionsProfile.class)
class TestExtensionResourceReadOnlyShould {

    public static class ReadOnlyExtensionsProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.readonly", "true",
                    "calm.extensions.dir", "local-dev/extensions",
                    "calm.extensions.example-services.backend-url", "http://localhost:8091");
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
                .body("values[0].routes.id", contains("screen", "namespace-services", "search"))
                .body("values[0].commands.keySet()", contains("list-services"));
    }
}
