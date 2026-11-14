package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTestProfile;
import org.finos.calm.extensions.FixtureBackend;

import java.security.GeneralSecurityException;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.Map;

/**
 * The oidc and secure profiles, with a local public key in place of the identity provider, so that
 * Hub starts with no OIDC server. Quarkus ignores the public key while an auth server URL is set,
 * and then fails each OIDC call with a 500, so both profiles clear the URL.
 */
final class OidcTestProfiles {

    private OidcTestProfiles() {
    }

    static String publicKey() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return Base64.getEncoder().encodeToString(generator.generateKeyPair().getPublic().getEncoded());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public static class Oidc implements QuarkusTestProfile {
        @Override
        public String getConfigProfile() {
            return "test,oidc";
        }

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "CALM_OIDC_ISSUER_URL", "https://idp.invalid/realms/calm",
                    "CALM_OIDC_CLIENT_ID", "calm-hub",
                    "quarkus.oidc.auth-server-url", "",
                    "quarkus.oidc.public-key", publicKey());
        }
    }

    public static class Secure implements QuarkusTestProfile {
        @Override
        public String getConfigProfile() {
            return "test,secure";
        }

        @Override
        public Map<String, String> getConfigOverrides() {
            // No TLS certificate in the tests, so serve plain http on the test port.
            return Map.of(
                    "quarkus.http.insecure-requests", "enabled",
                    "quarkus.http.ssl.certificate.files", "",
                    "quarkus.http.ssl.certificate.key-files", "",
                    "quarkus.oidc.auth-server-url", "",
                    "quarkus.oidc.public-key", publicKey());
        }
    }

    /** The oidc profile with an identity provider that is down: nothing listens on its port. */
    public static class IdpDown implements QuarkusTestProfile {
        @Override
        public String getConfigProfile() {
            return "test,oidc";
        }

        @Override
        public Map<String, String> getConfigOverrides() {
            String issuer = "http://127.0.0.1:" + FixtureBackend.freePort() + "/realms/calm";
            return Map.of(
                    "CALM_OIDC_ISSUER_URL", issuer,
                    "CALM_OIDC_CLIENT_ID", "calm-hub",
                    "quarkus.oidc.auth-server-url", issuer);
        }
    }
}
