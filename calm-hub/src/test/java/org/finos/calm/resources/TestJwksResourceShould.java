package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class TestJwksResourceShould {

    @Test
    void be_public_and_empty_when_no_key_is_configured() {
        given()
                .when()
                .get("/api/calm/auth/jwks")
                .then()
                .statusCode(200)
                .body(equalTo("{\"keys\":[]}"));
    }

    @Test
    void refuse_an_extension_identity_assertion_as_a_credential() {
        String header = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"alg\":\"RS256\",\"typ\":\"calm-ext+jwt\"}".getBytes(StandardCharsets.UTF_8));

        given()
                .header("Authorization", "Bearer " + header + ".e30.c2ln")
                .when()
                .get("/api/calm/auth/config")
                .then()
                .statusCode(401);
    }
}
