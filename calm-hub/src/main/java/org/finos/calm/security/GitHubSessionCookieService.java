package org.finos.calm.security;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * Encrypts/decrypts the GitHub session cookie payload using AES-256-GCM.
 * The cookie binds the GitHub token to the OIDC identity (oidcSub) and
 * includes an expiry timestamp.
 */
@ApplicationScoped
public class GitHubSessionCookieService {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubSessionCookieService.class);
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;
    private static final String FIELD_SEPARATOR = "";

    private final SecretKeySpec secretKey;
    private final int sessionTtlSeconds;
    private final SecureRandom secureRandom = new SecureRandom();

    @Inject
    public GitHubSessionCookieService(
            @ConfigProperty(name = "calm.github.session.key", defaultValue = "") Optional<String> keyBase64,
            @ConfigProperty(name = "calm.github.session.ttl", defaultValue = "3600") int sessionTtl) {
        this.sessionTtlSeconds = sessionTtl;
        if (keyBase64.isPresent() && !keyBase64.get().isBlank()) {
            byte[] keyBytes = Base64.getDecoder().decode(keyBase64.get());
            this.secretKey = new SecretKeySpec(keyBytes, "AES");
        } else {
            this.secretKey = null;
        }
    }

    GitHubSessionCookieService(byte[] key, int ttl) {
        this.secretKey = new SecretKeySpec(key, "AES");
        this.sessionTtlSeconds = ttl;
    }

    public boolean isConfigured() {
        return secretKey != null;
    }

    public String encrypt(String ghToken, String ghUsername, String oidcSub) {
        if (secretKey == null) {
            throw new IllegalStateException("Session key not configured (CALM_SESSION_KEY)");
        }
        try {
            Instant exp = Instant.now().plusSeconds(sessionTtlSeconds);
            String payload = String.join(FIELD_SEPARATOR, ghToken, ghUsername, oidcSub, exp.toString());

            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));

            byte[] encrypted = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[IV_LENGTH + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, IV_LENGTH);
            System.arraycopy(encrypted, 0, combined, IV_LENGTH, encrypted.length);

            return Base64.getUrlEncoder().withoutPadding().encodeToString(combined);
        } catch (Exception e) {
            LOG.error("Failed to encrypt session cookie", e);
            throw new RuntimeException("Encryption failed", e);
        }
    }

    public Optional<GitHubSession> decrypt(String cookieValue, String expectedOidcSub) {
        if (secretKey == null || cookieValue == null || cookieValue.isBlank()) {
            return Optional.empty();
        }
        try {
            byte[] combined = Base64.getUrlDecoder().decode(cookieValue);
            if (combined.length < IV_LENGTH) {
                return Optional.empty();
            }

            byte[] iv = new byte[IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH);
            byte[] encrypted = new byte[combined.length - IV_LENGTH];
            System.arraycopy(combined, IV_LENGTH, encrypted, 0, encrypted.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));

            byte[] decrypted = cipher.doFinal(encrypted);
            String payload = new String(decrypted, StandardCharsets.UTF_8);
            String[] fields = payload.split(FIELD_SEPARATOR);

            if (fields.length != 4) {
                LOG.warn("Invalid session cookie format — expected 4 fields, got {}", fields.length);
                return Optional.empty();
            }

            String ghToken = fields[0];
            String ghUsername = fields[1];
            String oidcSub = fields[2];
            Instant exp = Instant.parse(fields[3]);

            if (Instant.now().isAfter(exp)) {
                LOG.debug("Session cookie expired");
                return Optional.empty();
            }

            if (!oidcSub.equals(expectedOidcSub)) {
                LOG.warn("Session cookie oidcSub mismatch — cookie={}, bearer={}", oidcSub, expectedOidcSub);
                return Optional.empty();
            }

            return Optional.of(new GitHubSession(ghToken, ghUsername, oidcSub, exp));
        } catch (Exception e) {
            LOG.debug("Failed to decrypt session cookie: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public int getSessionTtlSeconds() {
        return sessionTtlSeconds;
    }

    public record GitHubSession(String ghToken, String ghUsername, String oidcSub, Instant exp) {}
}
