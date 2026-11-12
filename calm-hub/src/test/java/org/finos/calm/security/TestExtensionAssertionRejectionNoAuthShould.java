package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.resources.AuthDisabledProfile;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;

@QuarkusTest
@TestProfile(AuthDisabledProfile.class)
class TestExtensionAssertionRejectionNoAuthShould extends ExtensionAssertionRejection {

    @Test
    void let_a_request_with_no_assertion_through() {
        given().when().get(PROTECTED_PATH).then().statusCode(200);
    }
}
