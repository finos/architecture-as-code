package org.finos.calm.extensions;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.StartupEvent;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.spi.ObserverMethod;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.Config;
import org.finos.calm.config.ExtensionsConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.ECKey;
import java.security.interfaces.ECPublicKey;
import java.security.interfaces.RSAKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Signs the identity assertion that Hub sends to an extension in place of the user's token
 * (ADR 0010), and publishes the keys that verify it. The JDK signs, so that no JWT library has to
 * work in a native image. The operator supplies the keys: RSA for RS256 or P-256 for ES256. A
 * shared secret (HS256) is refused, because each extension could then mint its own assertions.
 */
@ApplicationScoped
public class ExtensionIdentitySigner {

    private static final Logger LOG = LoggerFactory.getLogger(ExtensionIdentitySigner.class);
    public static final String HEADER = "X-Calm-Hub-Identity";
    public static final String TYPE = "calm-ext+jwt";
    static final int MAX_TTL_SECONDS = 300;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Base64.Encoder BASE64URL = Base64.getUrlEncoder().withoutPadding();
    private static final int MIN_RSA_BITS = 2048;
    private static final String PREFIX = "calm.extensions.identity.";
    private static final String DEFAULT_ISSUER = "http://localhost:8080";

    private final ExtensionsConfig config;
    private final Config properties;
    private final ExtensionRegistry registry;
    private final Clock clock;
    private volatile SigningKey signingKey;
    private volatile List<Map<String, String>> jwks = List.of();
    private String issuer;
    private int ttlSeconds;

    private record SigningKey(PrivateKey key, String alg, String kid) {}

    @Inject
    public ExtensionIdentitySigner(ExtensionsConfig config, Config properties, ExtensionRegistry registry) {
        this(config, properties, registry, Clock.systemUTC());
    }

    ExtensionIdentitySigner(ExtensionsConfig config, Config properties, ExtensionRegistry registry, Clock clock) {
        this.config = config;
        this.properties = properties;
        this.registry = registry;
        this.clock = clock;
    }

    // After ExtensionRegistry has loaded, because a key is needed only when an extension has routes.
    void onStartup(@Observes @Priority(ObserverMethod.DEFAULT_PRIORITY + 100) StartupEvent event) {
        load();
    }

    void load() {
        // The same default as PluginAuthResource and CalmDocumentParser, which inject calm.hub.base-url.
        issuer = properties.getOptionalValue("calm.hub.base-url", String.class).orElse(DEFAULT_ISSUER);
        ttlSeconds = config.identity().ttlSeconds();
        if (ttlSeconds < 1 || ttlSeconds > MAX_TTL_SECONDS) {
            throw invalid(PREFIX + "ttl-seconds must be between 1 and " + MAX_TTL_SECONDS + ", but was " + ttlSeconds);
        }
        Optional<String> privateLocation = config.identity().privateKeyLocation().filter(l -> !l.isBlank());
        List<String> publicLocations = config.identity().publicKeyLocations().orElse(List.of());
        if (privateLocation.isEmpty()) {
            if (!publicLocations.isEmpty()) {
                throw invalid(PREFIX + "public-key-locations is set, but " + PREFIX + "private-key-location is not");
            }
            if (hasRoutes()) {
                throw invalid(PREFIX + "private-key-location must be set, because an enabled extension has routes");
            }
            return;
        }
        if (publicLocations.isEmpty()) {
            throw invalid(PREFIX + "public-key-locations must be set, with the public key of "
                    + PREFIX + "private-key-location first");
        }

        PrivateKey privateKey = readKey(privateLocation.get(), "PRIVATE KEY",
                (factory, der) -> factory.generatePrivate(new PKCS8EncodedKeySpec(der)));
        String alg = algorithm(privateKey, privateLocation.get());
        List<Map<String, String>> keys = new ArrayList<>();
        Set<String> kids = new HashSet<>();
        for (String location : publicLocations) {
            PublicKey publicKey = readKey(location, "PUBLIC KEY",
                    (factory, der) -> factory.generatePublic(new X509EncodedKeySpec(der)));
            Map<String, String> jwk = jwk(publicKey, algorithm(publicKey, location));
            if (!kids.add(jwk.get("kid"))) {
                throw invalid(PREFIX + "public-key-locations lists the key in " + location + " twice");
            }
            if (keys.isEmpty() && !isPair(privateKey, publicKey, alg)) {
                throw invalid("The first of " + PREFIX + "public-key-locations is not the public key of "
                        + PREFIX + "private-key-location");
            }
            keys.add(jwk);
        }
        jwks = List.copyOf(keys);
        signingKey = new SigningKey(privateKey, alg, keys.getFirst().get("kid"));
        // application-oidc.properties sets the default when CALM_HUB_BASE_URL is not set, so check the value.
        if (DEFAULT_ISSUER.equals(issuer) && hasRoutes()) {
            LOG.warn("calm.hub.base-url is the default {}, so it is the iss claim of each extension identity assertion. "
                    + "A backend that expects the real CALM Hub URL refuses every assertion", DEFAULT_ISSUER);
        }
    }

    private boolean hasRoutes() {
        return registry.enabled().stream().anyMatch(e -> !e.manifest().routes().isEmpty());
    }

    /** The public keys in JWK form. The first one signs. */
    public List<Map<String, String>> publicKeys() {
        return jwks;
    }

    public int ttlSeconds() {
        return ttlSeconds;
    }

    /**
     * Returns a compact JWS with the claims of ADR 0010. When {@code body} is not empty, the
     * {@code bdh} claim binds the assertion to it.
     */
    public String sign(ExtensionAssertion assertion, byte[] body) {
        SigningKey key = signingKey;
        if (key == null) {
            throw new IllegalStateException("No extension identity key is configured");
        }
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", key.alg());
        header.put("typ", TYPE);
        header.put("kid", key.kid());

        long now = clock.instant().getEpochSecond();
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", issuer);
        claims.put("sub", assertion.sub());
        claims.put("aud", assertion.aud());
        claims.put("iat", now);
        claims.put("exp", now + ttlSeconds);
        claims.put("jti", assertion.jti());
        claims.put("auth", assertion.auth());
        claims.put("hubApi", assertion.hubApi());
        claims.put("route", assertion.route());
        claims.put("scope", assertion.scope());
        if (assertion.ns() != null) {
            claims.put("ns", assertion.ns());
        }
        if (assertion.dom() != null) {
            claims.put("dom", assertion.dom());
        }
        claims.put("htm", assertion.htm());
        claims.put("htp", assertion.htp());
        if (body != null && body.length > 0) {
            claims.put("bdh", encode(sha256(body)));
        }

        try {
            String signingInput = encode(MAPPER.writeValueAsBytes(header)) + "." + encode(MAPPER.writeValueAsBytes(claims));
            byte[] signature = signBytes(key.key(), key.alg(), signingInput.getBytes(StandardCharsets.US_ASCII));
            return signingInput + "." + encode(signature);
        } catch (JsonProcessingException | GeneralSecurityException e) {
            throw new IllegalStateException("Cannot sign the extension identity assertion", e);
        }
    }

    /**
     * True when the token has the assertion {@code typ}, whoever signed it. Hub uses this to refuse
     * an assertion as a credential, so it does not check the signature.
     */
    public static boolean isAssertion(String token) {
        if (token == null) {
            return false;
        }
        int dot = token.indexOf('.');
        if (dot <= 0) {
            return false;
        }
        try {
            JsonNode header = MAPPER.readTree(Base64.getUrlDecoder().decode(token.substring(0, dot).trim()));
            return header != null && TYPE.equalsIgnoreCase(header.path("typ").asText(""));
        } catch (IllegalArgumentException | IOException e) {
            return false;
        }
    }

    private static String algorithm(Key key, String location) {
        if (key instanceof RSAKey rsa) {
            if (rsa.getModulus().bitLength() < MIN_RSA_BITS) {
                throw invalid("The RSA key in " + location + " must have at least " + MIN_RSA_BITS + " bits");
            }
            return "RS256";
        }
        if (key instanceof ECKey ec && isP256(ec.getParams())) {
            return "ES256";
        }
        throw invalid("The key in " + location + " must be an RSA key (RS256) or a P-256 key (ES256)");
    }

    private static boolean isP256(ECParameterSpec params) {
        try {
            AlgorithmParameters p256 = AlgorithmParameters.getInstance("EC");
            p256.init(new ECGenParameterSpec("secp256r1"));
            ECParameterSpec expected = p256.getParameterSpec(ECParameterSpec.class);
            return expected.getCurve().equals(params.getCurve()) && expected.getOrder().equals(params.getOrder())
                    && expected.getGenerator().equals(params.getGenerator());
        } catch (GeneralSecurityException e) {
            return false;
        }
    }

    private static boolean isPair(PrivateKey privateKey, PublicKey publicKey, String alg) {
        try {
            byte[] probe = "calm-hub-key-check".getBytes(StandardCharsets.US_ASCII);
            Signature verifier = Signature.getInstance(jcaName(alg));
            verifier.initVerify(publicKey);
            verifier.update(probe);
            return verifier.verify(signBytes(privateKey, alg, probe));
        } catch (GeneralSecurityException e) {
            return false;
        }
    }

    private static byte[] signBytes(PrivateKey key, String alg, byte[] input) throws GeneralSecurityException {
        Signature signer = Signature.getInstance(jcaName(alg));
        signer.initSign(key);
        signer.update(input);
        return signer.sign();
    }

    private static String jcaName(String alg) {
        // JWS needs the raw r || s form of an ECDSA signature, not DER.
        return "RS256".equals(alg) ? "SHA256withRSA" : "SHA256withECDSAinP1363Format";
    }

    private static Map<String, String> jwk(PublicKey key, String alg) {
        Map<String, String> jwk = new LinkedHashMap<>();
        // RFC 7638 thumbprint: the required members in lexicographic order, with no white space.
        String canonical;
        if (key instanceof RSAPublicKey rsa) {
            String e = encode(unsigned(rsa.getPublicExponent(), 0));
            String n = encode(unsigned(rsa.getModulus(), 0));
            canonical = "{\"e\":\"" + e + "\",\"kty\":\"RSA\",\"n\":\"" + n + "\"}";
            jwk.put("kty", "RSA");
            jwk.put("n", n);
            jwk.put("e", e);
        } else {
            ECPublicKey ec = (ECPublicKey) key;
            String x = encode(unsigned(ec.getW().getAffineX(), 32));
            String y = encode(unsigned(ec.getW().getAffineY(), 32));
            canonical = "{\"crv\":\"P-256\",\"kty\":\"EC\",\"x\":\"" + x + "\",\"y\":\"" + y + "\"}";
            jwk.put("kty", "EC");
            jwk.put("crv", "P-256");
            jwk.put("x", x);
            jwk.put("y", y);
        }
        jwk.put("use", "sig");
        jwk.put("alg", alg);
        jwk.put("kid", encode(sha256(canonical)));
        return jwk;
    }

    private static byte[] sha256(String value) {
        return sha256(value.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] sha256(byte[] value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Big-endian bytes with no sign byte, left-padded to {@code length} when it is not 0. */
    private static byte[] unsigned(BigInteger value, int length) {
        byte[] bytes = value.toByteArray();
        if (bytes.length > 1 && bytes[0] == 0) {
            bytes = Arrays.copyOfRange(bytes, 1, bytes.length);
        }
        if (length > bytes.length) {
            byte[] padded = new byte[length];
            System.arraycopy(bytes, 0, padded, length - bytes.length, bytes.length);
            return padded;
        }
        return bytes;
    }

    private static String encode(byte[] bytes) {
        return BASE64URL.encodeToString(bytes);
    }

    @FunctionalInterface
    private interface KeyDecoder<K extends Key> {
        K decode(KeyFactory factory, byte[] der) throws InvalidKeySpecException;
    }

    private static <K extends Key> K readKey(String location, String label, KeyDecoder<K> decoder) {
        String pem;
        try {
            pem = Files.readString(Path.of(location), StandardCharsets.US_ASCII);
        } catch (IOException | RuntimeException e) {
            throw invalid("Cannot read the key file " + location);
        }
        String begin = "-----BEGIN " + label + "-----";
        String end = "-----END " + label + "-----";
        int start = pem.indexOf(begin);
        int stop = pem.indexOf(end);
        if (start < 0 || stop < start) {
            throw invalid("The key file " + location + " must be a PEM file with a '" + begin + "' block"
                    + ("PRIVATE KEY".equals(label) ? " (PKCS#8)" : ""));
        }
        byte[] der;
        try {
            der = Base64.getMimeDecoder().decode(pem.substring(start + begin.length(), stop));
        } catch (IllegalArgumentException e) {
            throw invalid("The key file " + location + " is not valid PEM");
        }
        for (String type : List.of("RSA", "EC")) {
            try {
                return decoder.decode(KeyFactory.getInstance(type), der);
            } catch (InvalidKeySpecException | NoSuchAlgorithmException e) {
                // Try the next key type.
            }
        }
        throw invalid("The key in " + location + " must be an RSA key (RS256) or a P-256 key (ES256). "
                + "HS256 and other shared secrets are not allowed");
    }

    private static IllegalStateException invalid(String message) {
        return new IllegalStateException("Invalid calm.extensions configuration: " + message);
    }
}
