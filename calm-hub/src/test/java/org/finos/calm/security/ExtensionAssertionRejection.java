package org.finos.calm.security;

import io.quarkus.vertx.http.runtime.security.HttpAuthenticationMechanism;
import io.restassured.specification.RequestSpecification;
import jakarta.enterprise.inject.Any;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Each auth profile must fail a request that presents a CALM Hub extension assertion with 401, not
 * 500. Each subclass starts Hub in one profile.
 */
abstract class ExtensionAssertionRejection {

    static final String PROTECTED_PATH = "/api/calm/extensions/schema/0/blocks.schema.json";
    static final String TEST_SECURITY_PACKAGE = "io.quarkus.test.security";

    @Inject
    @Any
    Instance<HttpAuthenticationMechanism> mechanisms;

    static String assertion() {
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        String header = "{\"alg\":\"RS256\",\"typ\":\"calm-ext+jwt\",\"kid\":\"hub\"}";
        String claims = "{\"sub\":\"alice\",\"aud\":\"team-services\"}";
        return encoder.encodeToString(header.getBytes(StandardCharsets.UTF_8)) + "."
                + encoder.encodeToString(claims.getBytes(StandardCharsets.UTF_8)) + ".c2ln";
    }

    /** The headers that this profile needs, besides the assertion, to authenticate a caller. */
    RequestSpecification caller() {
        return given();
    }

    @Test
    void return_401_for_a_bearer_extension_assertion() {
        caller().header("Authorization", "Bearer " + assertion())
                .when().get(PROTECTED_PATH)
                .then().statusCode(401);
    }

    /** The 401 alone does not prove the order: OIDC with a local key also refuses a forged token. */
    @Test
    void run_the_assertion_check_before_every_other_mechanism() {
        int rejecting = mechanisms.select(ExtensionAssertionRejectingMechanism.class).get().getPriority();
        mechanisms.stream()
                .filter(mechanism -> !(mechanism instanceof ExtensionAssertionRejectingMechanism))
                // quarkus-test-security adds these on the test classpath only; a real Hub does not have them.
                .filter(mechanism -> !TEST_SECURITY_PACKAGE.equals(mechanism.getClass().getPackageName()))
                .forEach(mechanism -> assertTrue(mechanism.getPriority() < rejecting,
                        mechanism.getClass().getName() + " runs before the assertion check"));
    }
}
