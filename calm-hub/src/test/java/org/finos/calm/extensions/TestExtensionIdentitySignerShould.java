package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.smallrye.config.PropertiesConfigSource;
import io.smallrye.config.SmallRyeConfig;
import io.smallrye.config.SmallRyeConfigBuilder;
import org.finos.calm.config.ExtensionsConfig;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestExtensionIdentitySignerShould {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final long NOW = 1_800_000_000L;
    private static final ExtensionAssertion ASSERTION = new ExtensionAssertion("alice", "team-services", "jti-1",
            "oidc", 0, "services", "read", "finos.payments", null, "GET", "/namespaces/finos.payments/services?a=1");

    @TempDir
    Path tempDir;

    private final Map<String, String> properties = new HashMap<>();
    private final ExtensionRegistry registry = mock(ExtensionRegistry.class);

    @Test
    void sign_an_rs256_assertion_with_the_claims_of_adr_0010() throws Exception {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        useKeys(keys.privateKey(), keys.publicKey());
        properties.put("calm.hub.base-url", "https://hub.example.com");
        ExtensionIdentitySigner signer = signer();

        String token = signer.sign(ASSERTION, new byte[0]);

        JsonNode header = part(token, 0);
        assertThat(header.get("alg").asText(), is("RS256"));
        assertThat(header.get("typ").asText(), is("calm-ext+jwt"));
        assertThat(header.get("kid").asText(), is(signer.publicKeys().getFirst().get("kid")));
        JsonNode claims = part(token, 1);
        List<String> names = new ArrayList<>();
        claims.fieldNames().forEachRemaining(names::add);
        assertThat(names, equalTo(List.of(
                "iss", "sub", "aud", "iat", "exp", "jti", "auth", "hubApi", "route", "scope", "ns", "htm", "htp")));
        assertThat(claims.get("iss").asText(), is("https://hub.example.com"));
        assertThat(claims.get("sub").asText(), is("alice"));
        assertThat(claims.get("aud").asText(), is("team-services"));
        assertThat(claims.get("iat").asLong(), is(NOW));
        assertThat(claims.get("exp").asLong(), is(NOW + 60));
        assertThat(claims.get("jti").asText(), is("jti-1"));
        assertThat(claims.get("auth").asText(), is("oidc"));
        assertThat(claims.get("hubApi").asInt(), is(0));
        assertThat(claims.get("route").asText(), is("services"));
        assertThat(claims.get("scope").asText(), is("read"));
        assertThat(claims.get("ns").asText(), is("finos.payments"));
        assertThat(claims.get("htm").asText(), is("GET"));
        assertThat(claims.get("htp").asText(), is("/namespaces/finos.payments/services?a=1"));
        assertThat(verifies(token, "SHA256withRSA", keys.pair().getPublic()), is(true));
    }

    @Test
    void sign_an_es256_assertion_with_a_p256_key() throws Exception {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.ec(tempDir, "hub", "secp256r1");
        useKeys(keys.privateKey(), keys.publicKey());
        ExtensionIdentitySigner signer = signer();

        String token = signer.sign(ASSERTION, new byte[0]);

        assertThat(part(token, 0).get("alg").asText(), is("ES256"));
        assertThat(signature(token).length, is(64));
        assertThat(verifies(token, "SHA256withECDSAinP1363Format", keys.pair().getPublic()), is(true));
        Map<String, String> jwk = signer.publicKeys().getFirst();
        assertThat(jwk.get("kty"), is("EC"));
        assertThat(jwk.get("crv"), is("P-256"));
        assertThat(Base64.getUrlDecoder().decode(jwk.get("x")).length, is(32));
        assertThat(Base64.getUrlDecoder().decode(jwk.get("y")).length, is(32));
    }

    @Test
    void leave_out_ns_when_the_route_has_no_namespace() throws Exception {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        useKeys(keys.privateKey(), keys.publicKey());

        String token = signer().sign(new ExtensionAssertion("alice", "team-services", "jti-2", "none", 0,
                "screen", "authenticated", null, null, "GET", "/screen"), null);

        assertThat(part(token, 1).has("ns"), is(false));
        assertThat(part(token, 1).has("dom"), is(false));
        assertThat(part(token, 1).has("bdh"), is(false));
        assertThat(part(token, 1).get("iss").asText(), is("http://localhost:8080"));
    }

    @Test
    void warn_when_an_extension_has_routes_and_the_hub_url_is_the_default() {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        useKeys(keys.privateKey(), keys.publicKey());
        assertThat(TestExtensionManifestLoaderShould.captureWarnings(ExtensionIdentitySigner.class, this::signer), empty());

        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(new ExtensionManifest.Route("screen", "GET", "/screen", "authenticated", false)), null, null);
        when(registry.enabled()).thenReturn(List.of(new RegisteredExtension(manifest, 0, Optional.empty(),
                new ExtensionLimits(Duration.ofSeconds(1), Duration.ofSeconds(1), 1, 1, 1))));
        assertThat(TestExtensionManifestLoaderShould.captureWarnings(ExtensionIdentitySigner.class, this::signer),
                contains(containsString("calm.hub.base-url is the default")));

        // As application-oidc.properties sets it when CALM_HUB_BASE_URL is not set.
        properties.put("calm.hub.base-url", "http://localhost:8080");
        assertThat(TestExtensionManifestLoaderShould.captureWarnings(ExtensionIdentitySigner.class, this::signer),
                contains(containsString("calm.hub.base-url is the default")));

        properties.put("calm.hub.base-url", "https://hub.example.com");
        assertThat(TestExtensionManifestLoaderShould.captureWarnings(ExtensionIdentitySigner.class, this::signer), empty());
    }

    @Test
    void name_the_checked_domain_in_dom() throws Exception {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        useKeys(keys.privateKey(), keys.publicKey());

        String token = signer().sign(new ExtensionAssertion("alice", "team-services", "jti-3", "oidc", 0,
                "domain-services", "domain_read", null, "payments", "GET", "/domains/payments/services"), null);

        assertThat(part(token, 1).get("dom").asText(), is("payments"));
        assertThat(part(token, 1).has("ns"), is(false));
    }

    @Test
    void bind_a_body_with_its_base64url_sha256() throws Exception {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        useKeys(keys.privateKey(), keys.publicKey());
        byte[] body = "{\"name\":\"x\"}".getBytes(StandardCharsets.UTF_8);

        String token = signer().sign(ASSERTION, body);

        String expected = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(MessageDigest.getInstance("SHA-256").digest(body));
        assertThat(part(token, 1).get("bdh").asText(), is(expected));
        assertThat(part(signer().sign(ASSERTION, new byte[0]), 1).has("bdh"), is(false));
    }

    @Test
    void use_the_configured_lifetime() throws Exception {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        useKeys(keys.privateKey(), keys.publicKey());
        properties.put("calm.extensions.identity.ttl-seconds", "300");

        String token = signer().sign(ASSERTION, new byte[0]);

        assertThat(part(token, 1).get("exp").asLong(), is(NOW + 300));
    }

    @Test
    void reject_a_lifetime_over_300_seconds_or_under_1() {
        for (String ttl : List.of("301", "0")) {
            properties.put("calm.extensions.identity.ttl-seconds", ttl);

            IllegalStateException e = assertThrows(IllegalStateException.class, this::signer, ttl);

            assertThat(e.getMessage(), containsString("ttl-seconds must be between 1 and 300, but was " + ttl));
        }
    }

    @Test
    void list_every_public_key_with_the_signing_key_first() throws Exception {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        Path rfcKey = Path.of("src/test/resources/extensions-test/keys/rfc7638-public.pub");
        useKeys(keys.privateKey(), keys.publicKey(), rfcKey);

        List<Map<String, String>> jwks = signer().publicKeys();

        assertThat(jwks, hasSize(2));
        assertThat(jwks.getFirst().get("kty"), is("RSA"));
        assertThat(jwks.getFirst().get("use"), is("sig"));
        assertThat(jwks.getFirst().get("alg"), is("RS256"));
        // The thumbprint of the example key in RFC 7638, section 3.1.
        assertThat(jwks.get(1).get("kid"), is("NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs"));
        assertThat(jwks.get(1).get("e"), is("AQAB"));
        assertThat(jwks.get(1).containsKey("d"), is(false));
    }

    @Test
    void have_no_keys_and_not_sign_when_no_key_is_configured() {
        ExtensionIdentitySigner signer = signer();

        assertThat(signer.publicKeys(), empty());
        assertThrows(IllegalStateException.class, () -> signer.sign(ASSERTION, new byte[0]));
    }

    @Test
    void need_a_key_when_an_enabled_extension_has_routes() {
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(new ExtensionManifest.Route("screen", "GET", "/screen", "authenticated", false)), null, null);
        RegisteredExtension extension = new RegisteredExtension(manifest, 0, Optional.empty(),
                new ExtensionLimits(Duration.ofSeconds(1), Duration.ofSeconds(1), 1, 1, 1));
        when(registry.enabled()).thenReturn(List.of(extension));

        IllegalStateException e = assertThrows(IllegalStateException.class, this::signer);

        assertThat(e.getMessage(), containsString(
                "calm.extensions.identity.private-key-location must be set, because an enabled extension has routes"));
    }

    @Test
    void need_the_public_key_of_the_signing_key_first() {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        ExtensionTestKeys.KeyFiles other = ExtensionTestKeys.rsa(tempDir, "other");
        useKeys(keys.privateKey(), other.publicKey(), keys.publicKey());

        IllegalStateException e = assertThrows(IllegalStateException.class, this::signer);

        assertThat(e.getMessage(), containsString("is not the public key of calm.extensions.identity.private-key-location"));
    }

    @Test
    void need_public_keys_with_a_private_key_and_a_private_key_with_public_keys() {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        properties.put("calm.extensions.identity.private-key-location", keys.privateKey().toString());

        assertThat(assertThrows(IllegalStateException.class, this::signer).getMessage(),
                containsString("public-key-locations must be set"));

        properties.remove("calm.extensions.identity.private-key-location");
        properties.put("calm.extensions.identity.public-key-locations", keys.publicKey().toString());

        assertThat(assertThrows(IllegalStateException.class, this::signer).getMessage(),
                containsString("public-key-locations is set, but calm.extensions.identity.private-key-location is not"));
    }

    @Test
    void reject_the_same_public_key_twice() {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        useKeys(keys.privateKey(), keys.publicKey(), keys.publicKey());

        assertThat(assertThrows(IllegalStateException.class, this::signer).getMessage(), containsString("twice"));
    }

    @Test
    void reject_a_shared_secret() throws IOException {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        Path secret = Files.writeString(tempDir.resolve("hmac.pem"),
                ExtensionTestKeys.pem("PRIVATE KEY", "a-shared-secret-for-hs256".getBytes(StandardCharsets.US_ASCII)));
        useKeys(secret, keys.publicKey());

        IllegalStateException e = assertThrows(IllegalStateException.class, this::signer);

        assertThat(e.getMessage(), containsString("HS256 and other shared secrets are not allowed"));
    }

    @Test
    void reject_a_weak_rsa_key_and_an_ec_key_that_is_not_p256() {
        ExtensionTestKeys.KeyFiles weak = ExtensionTestKeys.weakRsa(tempDir, "weak");
        useKeys(weak.privateKey(), weak.publicKey());
        assertThat(assertThrows(IllegalStateException.class, this::signer).getMessage(),
                containsString("must have at least 2048 bits"));

        ExtensionTestKeys.KeyFiles p384 = ExtensionTestKeys.ec(tempDir, "p384", "secp384r1");
        useKeys(p384.privateKey(), p384.publicKey());
        assertThat(assertThrows(IllegalStateException.class, this::signer).getMessage(),
                containsString("must be an RSA key (RS256) or a P-256 key (ES256)"));
    }

    @Test
    void reject_a_missing_file_and_a_file_that_is_not_pkcs8() throws IOException {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        useKeys(tempDir.resolve("missing.pem"), keys.publicKey());
        assertThat(assertThrows(IllegalStateException.class, this::signer).getMessage(),
                containsString("Cannot read the key file"));

        Path pkcs1 = Files.writeString(tempDir.resolve("pkcs1.pem"), "-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----\n");
        useKeys(pkcs1, keys.publicKey());
        assertThat(assertThrows(IllegalStateException.class, this::signer).getMessage(),
                containsString("must be a PEM file with a '-----BEGIN PRIVATE KEY-----' block (PKCS#8)"));
    }

    @Test
    void recognise_an_assertion_by_its_type_only() throws Exception {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        useKeys(keys.privateKey(), keys.publicKey());
        String token = signer().sign(ASSERTION, new byte[0]);
        String otherType = encode("{\"alg\":\"RS256\",\"typ\":\"JWT\"}") + ".e30.sig";
        String forged = encode("{\"alg\":\"none\",\"typ\":\"CALM-EXT+JWT\"}") + ".e30.";

        assertThat(ExtensionIdentitySigner.isAssertion(token), is(true));
        assertThat(ExtensionIdentitySigner.isAssertion(forged), is(true));
        assertThat(ExtensionIdentitySigner.isAssertion(otherType), is(false));
        assertThat(ExtensionIdentitySigner.isAssertion("not-a-jwt"), is(false));
        assertThat(ExtensionIdentitySigner.isAssertion("%%%.e30.sig"), is(false));
        assertThat(ExtensionIdentitySigner.isAssertion(null), is(false));
    }

    private void useKeys(Path privateKey, Path... publicKeys) {
        properties.put("calm.extensions.identity.private-key-location", privateKey.toString());
        properties.put("calm.extensions.identity.public-key-locations",
                String.join(",", Arrays.stream(publicKeys).map(Path::toString).toList()));
    }

    private ExtensionIdentitySigner signer() {
        SmallRyeConfig config = new SmallRyeConfigBuilder()
                .withMapping(ExtensionsConfig.class)
                .withSources(new PropertiesConfigSource(Map.copyOf(properties), "test", 100))
                .build();
        ExtensionIdentitySigner signer = new ExtensionIdentitySigner(config.getConfigMapping(ExtensionsConfig.class),
                config, registry, Clock.fixed(Instant.ofEpochSecond(NOW), ZoneOffset.UTC));
        signer.load();
        return signer;
    }

    private static JsonNode part(String token, int index) throws IOException {
        return MAPPER.readTree(Base64.getUrlDecoder().decode(token.split("\\.")[index]));
    }

    private static byte[] signature(String token) {
        return Base64.getUrlDecoder().decode(token.split("\\.")[2]);
    }

    private static boolean verifies(String token, String algorithm, PublicKey key) throws Exception {
        Signature verifier = Signature.getInstance(algorithm);
        verifier.initVerify(key);
        verifier.update(token.substring(0, token.lastIndexOf('.')).getBytes(StandardCharsets.US_ASCII));
        return verifier.verify(signature(token));
    }

    private static String encode(String json) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }
}
