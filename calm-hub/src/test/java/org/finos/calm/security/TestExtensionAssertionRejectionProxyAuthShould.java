package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;

@QuarkusTest
@TestProfile(TestExtensionAssertionRejectionProxyAuthShould.ProxyAuthProfile.class)
class TestExtensionAssertionRejectionProxyAuthShould extends ExtensionAssertionRejection {

    public static class ProxyAuthProfile implements QuarkusTestProfile {
        @Override
        public String getConfigProfile() {
            // The last profile wins, and ProxyAuthenticationMechanism is a build-time proxy-auth bean.
            return "test,proxy-auth";
        }
    }

    @Override
    RequestSpecification caller() {
        return given().header("Remote-User", "alice");
    }

    @Test
    void authenticate_the_proxy_user_when_there_is_no_assertion() {
        caller().when().get(PROTECTED_PATH).then().statusCode(200);
    }
}
