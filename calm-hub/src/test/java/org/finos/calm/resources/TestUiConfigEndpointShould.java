package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class TestUiConfigEndpointShould {

    @Test
    void return_401_when_not_authenticated() {
        given()
                .when()
                .get("/api/calm/ui/config")
                .then()
                .statusCode(401);
    }

    @Test
    @TestSecurity(user = "alice")
    void return_an_empty_object_when_nothing_is_configured() {
        given()
                .when()
                .get("/api/calm/ui/config")
                .then()
                .statusCode(200)
                .body(equalTo("{}"));
    }
}
