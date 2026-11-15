package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.extensions.ExtensionTestKeys;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
@TestProfile(TestJwksResourceWithKeysShould.KeysProfile.class)
class TestJwksResourceWithKeysShould {

    public static class KeysProfile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations",
                    KEYS.publicKey() + ",src/test/resources/extensions-test/keys/rfc7638-public.pub");
        }
    }

    @Test
    void list_every_public_key_with_the_signing_key_first() {
        given()
                .when()
                .get("/api/calm/auth/jwks")
                .then()
                .statusCode(200)
                .body("keys", hasSize(2))
                .body("keys[0].kty", equalTo("RSA"))
                .body("keys[0].alg", equalTo("RS256"))
                .body("keys[0].use", equalTo("sig"))
                .body("keys[0].d", nullValue())
                .body("keys[1].kid", equalTo("NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs"));
    }
}
