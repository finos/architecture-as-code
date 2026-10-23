package org.finos.calm.extensions;

import io.smallrye.jwt.algorithm.SignatureAlgorithm;
import io.smallrye.jwt.build.Jwt;
import io.smallrye.jwt.util.KeyUtils;
import io.quarkus.runtime.Startup;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.config.ExtensionsConfig;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.interfaces.RSAPrivateCrtKey;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Signs the short-lived identity that Hub sends to an extension in place of the user's token.
 * Extensions check it against {@code GET /api/calm/auth/jwks}.
 */
@Startup
@ApplicationScoped
public class ExtensionIdentitySigner {

    public static final String HEADER = "X-Calm-Hub-Identity";

    private final ExtensionsConfig config;
    private PrivateKey privateKey;
    private Map<String, String> jwk;

    @Inject
    public ExtensionIdentitySigner(ExtensionsConfig config) {
        this.config = config;
    }

    @PostConstruct
    void init() {
        config.identity().privateKeyLocation().ifPresent(location -> {
            try {
                PrivateKey key = KeyUtils.decodePrivateKey(Files.readString(Path.of(location)));
                if (!(key instanceof RSAPrivateCrtKey rsa)) {
                    throw new IllegalStateException("The extension identity key must be an RSA key");
                }
                privateKey = key;
                jwk = publicJwk(rsa);
            } catch (Exception e) {
                throw new IllegalStateException("Cannot read the extension identity key from " + location, e);
            }
        });
    }

    public String sign(String username, String extensionId) {
        if (privateKey == null) {
            throw new IllegalStateException("No extension identity key is configured");
        }
        long now = Instant.now().getEpochSecond();
        return Jwt.issuer(config.identity().issuer())
                .subject(username)
                .audience(extensionId)
                .issuedAt(now)
                .expiresAt(now + config.identity().ttlSeconds())
                .jws()
                .keyId(jwk.get("kid"))
                .algorithm(SignatureAlgorithm.RS256)
                .sign(privateKey);
    }

    public List<Map<String, String>> publicKeys() {
        return jwk == null ? List.of() : List.of(jwk);
    }

    private static Map<String, String> publicJwk(RSAPrivateCrtKey key) throws GeneralSecurityException {
        String n = base64Url(key.getModulus());
        String e = base64Url(key.getPublicExponent());
        // RFC 7638 thumbprint: members in lexicographic order, no whitespace.
        String canonical = "{\"e\":\"" + e + "\",\"kty\":\"RSA\",\"n\":\"" + n + "\"}";
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
        String kid = Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        return Map.of("kty", "RSA", "use", "sig", "alg", "RS256", "kid", kid, "n", n, "e", e);
    }

    private static String base64Url(BigInteger value) {
        byte[] bytes = value.toByteArray();
        if (bytes.length > 1 && bytes[0] == 0) {
            bytes = Arrays.copyOfRange(bytes, 1, bytes.length);
        }
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
