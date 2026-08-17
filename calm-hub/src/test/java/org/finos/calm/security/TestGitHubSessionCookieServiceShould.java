package org.finos.calm.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

class TestGitHubSessionCookieServiceShould {

    private GitHubSessionCookieService service;
    private static final byte[] TEST_KEY = new byte[32]; // 256-bit key (all zeros for testing)

    @BeforeEach
    void setup() {
        service = new GitHubSessionCookieService(TEST_KEY, 3600);
    }

    @Test
    void encrypt_and_decrypt_round_trip() {
        String encrypted = service.encrypt("gho_token123", "alice-gh", "sub-abc");

        Optional<GitHubSessionCookieService.GitHubSession> result = service.decrypt(encrypted, "sub-abc");

        assertThat(result.isPresent(), is(true));
        assertThat(result.get().ghToken(), equalTo("gho_token123"));
        assertThat(result.get().ghUsername(), equalTo("alice-gh"));
        assertThat(result.get().oidcSub(), equalTo("sub-abc"));
        assertThat(result.get().exp(), is(notNullValue()));
    }

    @Test
    void return_empty_when_oidc_sub_does_not_match() {
        String encrypted = service.encrypt("gho_token", "user", "sub-abc");

        Optional<GitHubSessionCookieService.GitHubSession> result = service.decrypt(encrypted, "sub-DIFFERENT");

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void return_empty_for_expired_cookie() {
        GitHubSessionCookieService shortLived = new GitHubSessionCookieService(TEST_KEY, -1);
        String encrypted = shortLived.encrypt("gho_token", "user", "sub-abc");

        Optional<GitHubSessionCookieService.GitHubSession> result = shortLived.decrypt(encrypted, "sub-abc");

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void return_empty_for_null_cookie_value() {
        Optional<GitHubSessionCookieService.GitHubSession> result = service.decrypt(null, "sub");
        assertThat(result.isPresent(), is(false));
    }

    @Test
    void return_empty_for_blank_cookie_value() {
        Optional<GitHubSessionCookieService.GitHubSession> result = service.decrypt("  ", "sub");
        assertThat(result.isPresent(), is(false));
    }

    @Test
    void return_empty_for_tampered_cookie() {
        String encrypted = service.encrypt("gho_token", "user", "sub-abc");
        String tampered = encrypted.substring(0, encrypted.length() - 5) + "XXXXX";

        Optional<GitHubSessionCookieService.GitHubSession> result = service.decrypt(tampered, "sub-abc");

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void return_empty_when_decrypted_with_wrong_key() {
        String encrypted = service.encrypt("gho_token", "user", "sub-abc");

        byte[] wrongKey = new byte[32];
        wrongKey[0] = 1;
        GitHubSessionCookieService otherService = new GitHubSessionCookieService(wrongKey, 3600);

        Optional<GitHubSessionCookieService.GitHubSession> result = otherService.decrypt(encrypted, "sub-abc");

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void report_configured_when_key_is_set() {
        assertThat(service.isConfigured(), is(true));
    }

    @Test
    void report_not_configured_when_key_is_missing() {
        GitHubSessionCookieService unconfigured = new GitHubSessionCookieService(Optional.empty(), 3600);
        assertThat(unconfigured.isConfigured(), is(false));
    }

    @Test
    void return_empty_for_too_short_cookie() {
        String tooShort = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("short".getBytes());
        Optional<GitHubSessionCookieService.GitHubSession> result = service.decrypt(tooShort, "sub");
        assertThat(result.isPresent(), is(false));
    }

    @Test
    void throw_when_encrypting_without_key() {
        GitHubSessionCookieService unconfigured = new GitHubSessionCookieService(Optional.empty(), 3600);
        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> unconfigured.encrypt("token", "user", "sub"));
    }

    @Test
    void return_session_ttl_seconds() {
        assertThat(service.getSessionTtlSeconds(), equalTo(3600));
    }

    @Test
    void return_empty_for_invalid_base64() {
        Optional<GitHubSessionCookieService.GitHubSession> result = service.decrypt("not!valid!base64!", "sub");
        assertThat(result.isPresent(), is(false));
    }

    @Test
    void construct_with_optional_key() {
        byte[] key = new byte[32];
        for (int i = 0; i < key.length; i++) {
            key[i] = (byte) (i + 1);
        }
        String keyBase64 = java.util.Base64.getEncoder().encodeToString(key);
        GitHubSessionCookieService svc = new GitHubSessionCookieService(Optional.of(keyBase64), 7200);
        assertThat(svc.isConfigured(), is(true));
        assertThat(svc.getSessionTtlSeconds(), equalTo(7200));
    }

    @Test
    void return_empty_when_service_not_configured_and_decrypt_called() {
        GitHubSessionCookieService unconfigured = new GitHubSessionCookieService(Optional.empty(), 3600);
        Optional<GitHubSessionCookieService.GitHubSession> result = unconfigured.decrypt("anything", "sub");
        assertThat(result.isPresent(), is(false));
    }
}
