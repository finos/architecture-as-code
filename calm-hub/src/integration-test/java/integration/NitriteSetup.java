package integration;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;

public class NitriteSetup {

    public static void namespaceSetup() {
        namespaceSetup("finos", "FINOS namespace");
    }

    /**
     * Seeds a dedicated namespace by name, for suites that must not share {@code finos} with
     * the rest of the {@code Nitrite*Integration} suite — see {@code NitriteLayoutIntegration}.
     */
    public static void namespaceSetup(String name, String description) {
        given()
                .body("{\"name\": \"" + name + "\", \"description\": \"" + description + "\"}")
                .header("Content-Type", "application/json")
                .when().post("/api/calm/namespaces")
                .then()
                .statusCode(anyOf(is(201), is(409)));
    }

    public static void domainSetup() {
        given()
                .body("{\"name\": \"security\"}")
                .header("Content-Type", "application/json")
                .when().post("/calm/domains")
                .then()
                .statusCode(anyOf(is(201), is(409)));
    }
}
