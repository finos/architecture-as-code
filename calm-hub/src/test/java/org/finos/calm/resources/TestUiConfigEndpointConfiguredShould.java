package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;

@QuarkusTest
@TestProfile(TestUiConfigEndpointConfiguredShould.UiConfiguredProfile.class)
class TestUiConfigEndpointConfiguredShould {

    public static class UiConfiguredProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.ui.environment.name", "UAT",
                    "calm.ui.environment.colour", "error",
                    "calm.ui.identity.enabled", "true",
                    "calm.ui.identity.show-roles", "true",
                    "calm.ui.items[0].label", "Build",
                    "calm.ui.items[0].value", "2026.10.1",
                    "calm.ui.items[1].label", "Support",
                    "calm.ui.items[1].url", "https://support.example.com");
        }
    }

    @Test
    @TestSecurity(user = "alice", roles = {"writers", "admins"})
    void return_every_configured_section() {
        given()
                .when()
                .get("/api/calm/ui/config")
                .then()
                .statusCode(200)
                .body("environment.name", equalTo("UAT"))
                .body("environment.colour", equalTo("error"))
                .body("identity.name", equalTo("alice"))
                .body("identity.roles", contains("admins", "writers"))
                .body("items.label", contains("Build", "Support"))
                .body("items[0].value", equalTo("2026.10.1"))
                .body("items[0]", not(hasKey("url")))
                .body("items[1].url", equalTo("https://support.example.com"));
    }
}
