package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;

/** A bearer assertion gets 401 also when the OIDC challenge cannot reach the identity provider. */
@QuarkusTest
@TestProfile(OidcTestProfiles.IdpDown.class)
class TestExtensionAssertionRejectionIdpDownShould extends ExtensionAssertionRejection {

    @Test
    void send_the_bearer_challenge_for_an_assertion() {
        given().header("Authorization", "Bearer " + assertion())
                .when().get(PROTECTED_PATH)
                .then().statusCode(401)
                .header("WWW-Authenticate", "Bearer error=\"invalid_token\"");
    }
}
