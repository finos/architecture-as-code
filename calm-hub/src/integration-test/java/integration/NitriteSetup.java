package integration;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;

public class NitriteSetup {

    public static void namespaceSetup() {
        given()
                .body("{\"name\": \"finos\", \"description\": \"FINOS namespace\"}")
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces")
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
