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
import static org.hamcrest.Matchers.startsWith;
import static org.hamcrest.MatcherAssert.assertThat;

@QuarkusTest
@TestProfile(TestUiConfigEndpointConfiguredShould.UiConfiguredProfile.class)
class TestUiConfigEndpointConfiguredShould {

    public static class UiConfiguredProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.ofEntries(
                    Map.entry("calm.ui.environment.name", "UAT"),
                    Map.entry("calm.ui.environment.colour", "error"),
                    Map.entry("calm.ui.identity.enabled", "true"),
                    Map.entry("calm.ui.identity.show-roles", "true"),
                    Map.entry("calm.ui.items[0].label", "Build"),
                    Map.entry("calm.ui.items[0].value", "2026.10.1"),
                    Map.entry("calm.ui.items[1].label", "Support"),
                    Map.entry("calm.ui.items[1].url", "https://support.example.com"),
                    Map.entry("calm.ui.branding.organisation-name", "Northstar Financial"),
                    Map.entry("calm.ui.branding.application-name", "Architecture Hub"),
                    Map.entry("calm.ui.branding.colour", "#0f766e"),
                    Map.entry("calm.ui.branding.logo.light", "src/test/resources/branding/logo.png"),
                    Map.entry("calm.ui.navigation.layout", "sidebar"),
                    Map.entry("calm.ui.navigation.show-namespaces", "false"),
                    Map.entry("calm.ui.navigation.start-page", "/extensions/assurance/reviews"));
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
                .body("items[1].url", equalTo("https://support.example.com"))
                .body("branding.organisationName", equalTo("Northstar Financial"))
                .body("branding.applicationName", equalTo("Architecture Hub"))
                .body("branding.colour", equalTo("#0f766e"))
                .body("branding", not(hasKey("colourDark")))
                .body("branding.logo.light", startsWith("/api/calm/ui/branding/logo/light?v="))
                .body("branding.logo", not(hasKey("dark")))
                .body("navigation.layout", equalTo("sidebar"))
                .body("navigation.showNamespaces", equalTo(false))
                .body("navigation.showControlDomains", equalTo(true))
                .body("navigation", not(hasKey("extensionsHeading")))
                .body("navigation.startPage", equalTo("/extensions/assurance/reviews"));
    }

    @Test
    @TestSecurity(user = "alice")
    void serve_the_logo_at_the_url_in_the_config() {
        String url = given().get("/api/calm/ui/config").then().extract().path("branding.logo.light");

        byte[] logo = given()
                .when()
                .get(url)
                .then()
                .statusCode(200)
                .contentType("image/png")
                .header("X-Content-Type-Options", "nosniff")
                .extract().asByteArray();
        assertThat(logo.length, equalTo(70));
    }

    @Test
    @TestSecurity(user = "alice")
    void return_404_for_a_dark_logo_that_is_not_configured() {
        given().when().get("/api/calm/ui/branding/logo/dark").then().statusCode(404);
    }

    @Test
    void refuse_the_logo_without_authentication() {
        given().when().get("/api/calm/ui/branding/logo/light").then().statusCode(401);
    }
}
