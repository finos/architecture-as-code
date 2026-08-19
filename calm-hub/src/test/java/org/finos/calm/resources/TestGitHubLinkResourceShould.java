package org.finos.calm.resources;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;
import org.finos.calm.security.GitHubOAuthClient;
import org.finos.calm.security.GitHubSessionCookieService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubLinkResourceShould {

    @Mock
    private GitHubSessionCookieService mockCookieService;

    @Mock
    private GitHubOAuthClient mockOAuthClient;

    @Mock
    private SecurityIdentity mockIdentity;

    @Mock
    private Principal mockPrincipal;

    private GitHubLinkResource resource;

    @BeforeEach
    void setup() throws Exception {
        resource = new GitHubLinkResource();
        setField("cookieService", mockCookieService);
        setField("oauthClient", mockOAuthClient);
        setField("identity", mockIdentity);
        setField("githubClientId", Optional.of("test-client-id"));
        setField("githubClientSecret", Optional.of("test-secret"));
        setField("githubScope", "repo");
        setField("githubBaseUrl", "https://github.com");
        setField("cookieSecure", true);
    }

    private void setField(String name, Object value) throws Exception {
        Field field = GitHubLinkResource.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(resource, value);
    }

    // --- /link tests ---

    @Test
    void return_501_when_oauth_client_id_is_empty() throws Exception {
        setField("githubClientId", Optional.of(""));

        Response response = resource.link();

        assertThat(response.getStatus(), equalTo(501));
    }

    @Test
    void return_501_when_oauth_client_id_is_absent() throws Exception {
        setField("githubClientId", Optional.empty());

        Response response = resource.link();

        assertThat(response.getStatus(), equalTo(501));
    }

    @Test
    void return_501_when_session_key_not_configured() {
        when(mockCookieService.isConfigured()).thenReturn(false);

        Response response = resource.link();

        assertThat(response.getStatus(), equalTo(501));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_authorize_url_when_configured() {
        when(mockCookieService.isConfigured()).thenReturn(true);
        when(mockCookieService.createOAuthState("sub-123")).thenReturn("signed-state");
        when(mockIdentity.getAttribute("sub")).thenReturn("sub-123");

        Response response = resource.link();

        assertThat(response.getStatus(), equalTo(200));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("authorizeUrl"), containsString("client_id=test-client-id"));
        assertThat(body.get("authorizeUrl"), containsString("state=signed-state"));
        assertThat(body.get("authorizeUrl"), containsString("scope=repo"));
    }

    @Test
    void link_uses_principal_name_when_sub_attribute_is_null() {
        when(mockCookieService.isConfigured()).thenReturn(true);
        when(mockIdentity.getAttribute("sub")).thenReturn(null);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("user@company.com");
        when(mockCookieService.createOAuthState("user@company.com")).thenReturn("state-token");

        Response response = resource.link();

        assertThat(response.getStatus(), equalTo(200));
    }

    // --- /callback tests ---

    @Test
    void return_400_when_callback_code_is_missing() {
        Response response = resource.callback(null, "some-state");

        assertThat(response.getStatus(), equalTo(400));
    }

    @Test
    void return_400_when_callback_code_is_blank() {
        Response response = resource.callback("  ", "some-state");

        assertThat(response.getStatus(), equalTo(400));
    }

    @Test
    void return_501_when_callback_client_id_not_configured() throws Exception {
        setField("githubClientId", Optional.empty());

        Response response = resource.callback("valid-code", "some-state");

        assertThat(response.getStatus(), equalTo(501));
    }

    @Test
    void return_501_when_callback_client_secret_not_configured() throws Exception {
        setField("githubClientSecret", Optional.empty());

        Response response = resource.callback("valid-code", "some-state");

        assertThat(response.getStatus(), equalTo(501));
    }

    @Test
    void return_403_when_callback_state_is_null() {
        when(mockCookieService.verifyOAuthState(null)).thenReturn(Optional.empty());

        Response response = resource.callback("valid-code", null);

        assertThat(response.getStatus(), equalTo(403));
    }

    @Test
    void return_403_when_callback_state_is_invalid() {
        when(mockCookieService.verifyOAuthState("bad-state")).thenReturn(Optional.empty());

        Response response = resource.callback("valid-code", "bad-state");

        assertThat(response.getStatus(), equalTo(403));
    }

    @Test
    void return_502_when_token_exchange_fails() {
        when(mockCookieService.verifyOAuthState("valid-state")).thenReturn(Optional.of("sub-123"));
        when(mockOAuthClient.exchangeCode("test-client-id", "test-secret", "valid-code"))
                .thenReturn(new GitHubOAuthClient.TokenResponse(null, "exchange failed"));

        Response response = resource.callback("valid-code", "valid-state");

        assertThat(response.getStatus(), equalTo(502));
    }

    @Test
    void return_redirect_with_cookie_on_successful_callback() {
        when(mockCookieService.verifyOAuthState("valid-state")).thenReturn(Optional.of("sub-123"));
        when(mockOAuthClient.exchangeCode("test-client-id", "test-secret", "valid-code"))
                .thenReturn(new GitHubOAuthClient.TokenResponse("gho_token123", null));
        when(mockOAuthClient.fetchUsername("gho_token123")).thenReturn("alice-gh");
        when(mockCookieService.encrypt("gho_token123", "alice-gh", "sub-123")).thenReturn("encrypted-cookie");
        when(mockCookieService.getSessionTtlSeconds()).thenReturn(3600);

        Response response = resource.callback("valid-code", "valid-state");

        assertThat(response.getStatus(), equalTo(307));
        NewCookie cookie = response.getCookies().get("calm_gh_session");
        assertThat(cookie, is(notNullValue()));
        assertThat(cookie.getValue(), equalTo("encrypted-cookie"));
        assertThat(cookie.getMaxAge(), equalTo(3600));
        assertThat(cookie.isHttpOnly(), is(true));
        assertThat(cookie.isSecure(), is(true));
    }

    // --- /status tests ---

    @Test
    @SuppressWarnings("unchecked")
    void return_linked_false_when_cookie_service_not_configured_on_status() {
        when(mockCookieService.isConfigured()).thenReturn(false);

        Response response = resource.status(null);

        assertThat(response.getStatus(), equalTo(200));
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertThat(body.get("linked"), equalTo(false));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_linked_true_with_username_when_session_valid() {
        when(mockCookieService.isConfigured()).thenReturn(true);
        when(mockIdentity.getAttribute("sub")).thenReturn("sub-123");
        GitHubSessionCookieService.GitHubSession session =
                new GitHubSessionCookieService.GitHubSession("token", "alice-gh", "sub-123", Instant.now().plusSeconds(3600));
        when(mockCookieService.decrypt("encrypted-cookie", "sub-123")).thenReturn(Optional.of(session));

        Response response = resource.status("encrypted-cookie");

        assertThat(response.getStatus(), equalTo(200));
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertThat(body.get("linked"), equalTo(true));
        assertThat(body.get("username"), equalTo("alice-gh"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_linked_false_when_session_invalid() {
        when(mockCookieService.isConfigured()).thenReturn(true);
        when(mockIdentity.getAttribute("sub")).thenReturn("sub-123");
        when(mockCookieService.decrypt("bad-cookie", "sub-123")).thenReturn(Optional.empty());

        Response response = resource.status("bad-cookie");

        assertThat(response.getStatus(), equalTo(200));
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertThat(body.get("linked"), equalTo(false));
    }

    // --- /unlink tests ---

    @Test
    @SuppressWarnings("unchecked")
    void unlink_returns_expired_cookie_and_linked_false() {
        Response response = resource.unlink();

        assertThat(response.getStatus(), equalTo(200));
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertThat(body.get("linked"), equalTo(false));

        NewCookie cookie = response.getCookies().get("calm_gh_session");
        assertThat(cookie, is(notNullValue()));
        assertThat(cookie.getMaxAge(), equalTo(0));
        assertThat(cookie.isHttpOnly(), is(true));
        assertThat(cookie.isSecure(), is(true));
    }
}
