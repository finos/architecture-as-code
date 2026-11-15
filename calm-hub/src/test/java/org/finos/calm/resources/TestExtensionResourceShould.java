package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.contains;

@QuarkusTest
class TestExtensionResourceShould {

    @Test
    void return_401_when_not_authenticated() {
        given()
                .when()
                .get("/api/calm/extensions")
                .then()
                .statusCode(401);
    }

    @Test
    @TestSecurity(user = "alice")
    void return_route_less_builtin_views_when_no_extensions_are_configured() {
        given()
                .when()
                .get("/api/calm/extensions")
                .then()
                .statusCode(200)
                .body("values.id", contains("control-evaluation", "deployment"))
                .body("values[0].routes.size()", equalTo(0))
                .body("values[0].contributes.decorator-views[0].overlay.hide", contains("not-applicable"))
                .body("values[0].contributes.decorator-views[0].overlay.key", equalTo("/control/unique-id"))
                .body("values[1].contributes.decorator-views[0].overlay.time", equalTo("/start-time"));
    }
    @Test
    @TestSecurity(user = "alice")
    void serve_the_versioned_blocks_schema() {
        given().when().get("/api/calm/extensions/schema/0/blocks.schema.json")
                .then().statusCode(200).body("properties.hubApi.const", equalTo(0));
    }

    @Test
    void protect_the_blocks_schema() {
        given().when().get("/api/calm/extensions/schema/0/blocks.schema.json")
                .then().statusCode(401);
    }
}
