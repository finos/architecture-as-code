package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;

@QuarkusTest
class TestCoffeeResourceShould {

    @Test
    void return_418_when_asked_to_brew_coffee() {
        given()
                .when()
                .get("/coffee")
                .then()
                .statusCode(418);
    }

    /* Pun-testing */
    @Test
    void return_teapot_message_when_asked_to_brew_coffee() {
        given()
                .when()
                .get("/coffee")
                .then()
                .body(containsString("TEApot"))
                .body(containsString("Topology-Expressed Architecture"))
                .body(containsString("CALMly"));
    }
}
