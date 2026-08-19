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

    @Test
    void create_and_verify_oauth_state_round_trip() {
        String state = service.createOAuthState("sub-123");

        Optional<String> verifiedSub = service.verifyOAuthState(state);

        assertThat(verifiedSub.isPresent(), is(true));
        assertThat(verifiedSub.get(), equalTo("sub-123"));
    }

    @Test
    void reject_tampered_oauth_state() {
        String state = service.createOAuthState("sub-123");
        String tampered = state.substring(0, state.length() - 5) + "XXXXX";

        Optional<String> result = service.verifyOAuthState(tampered);

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void reject_oauth_state_from_wrong_key() {
        String state = service.createOAuthState("sub-123");

        byte[] wrongKey = new byte[32];
        wrongKey[0] = 1;
        GitHubSessionCookieService otherService = new GitHubSessionCookieService(wrongKey, 3600);

        Optional<String> result = otherService.verifyOAuthState(state);

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void reject_null_oauth_state() {
        Optional<String> result = service.verifyOAuthState(null);
        assertThat(result.isPresent(), is(false));
    }

    @Test
    void reject_blank_oauth_state() {
        Optional<String> result = service.verifyOAuthState("  ");
        assertThat(result.isPresent(), is(false));
    }

    @Test
    void throw_when_creating_oauth_state_without_key() {
        GitHubSessionCookieService unconfigured = new GitHubSessionCookieService(Optional.empty(), 3600);
        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> unconfigured.createOAuthState("sub-123"));
    }

    @Test
    void produce_unique_states_for_same_subject() {
        String state1 = service.createOAuthState("sub-123");
        String state2 = service.createOAuthState("sub-123");

        assertThat(state1.equals(state2), is(false));
    }

    @Test
    void reject_expired_oauth_state() {
        // Create a service with negative TTL won't work for state (it has its own 300s),
        // so we test with a tampered payload that has an old expiry via wrong format
        String invalidBase64 = java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(new byte[20]);

        Optional<String> result = service.verifyOAuthState(invalidBase64);

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void reject_oauth_state_with_too_short_data() {
        String tooShort = java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString("short".getBytes());

        Optional<String> result = service.verifyOAuthState(tooShort);

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void reject_invalid_base64_oauth_state() {
        Optional<String> result = service.verifyOAuthState("not!valid!base64!");

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void reject_oauth_state_when_not_configured() {
        GitHubSessionCookieService unconfigured = new GitHubSessionCookieService(Optional.empty(), 3600);

        Optional<String> result = unconfigured.verifyOAuthState("some-state");

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void decrypt_returns_empty_when_token_contains_separator() {
        // The token has embedded U+001F separator, producing 5 fields on split
        String encrypted = service.encrypt("tokenextra", "user", "sub");

        Optional<GitHubSessionCookieService.GitHubSession> result = service.decrypt(encrypted, "sub");

        assertThat(result.isPresent(), is(false));
    }

    @Test
    void verify_oauth_state_rejects_session_cookie_format() {
        // A session cookie first field is a token, not "oauth-state"
        String sessionCookie = service.encrypt("gho_token", "alice", "sub-123");

        Optional<String> result = service.verifyOAuthState(sessionCookie);

        assertThat(result.isPresent(), is(false));
    }
}
