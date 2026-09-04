package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.finos.calm.security.OidcPluginAuthClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.net.URI;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestPluginAuthResourceShould {

    private static final String AUTH_SERVER_URL = "https://login.microsoftonline.com/tenant-id/v2.0";
    private static final String CLIENT_ID = "calm-hub-client";
    private static final String CLIENT_SECRET = "super-secret";
    private static final String HUB_BASE_URL = "http://localhost:8080";
    private static final String SCOPES = "openid profile email";
    private static final String AUTHORIZATION_ENDPOINT = "https://login.microsoftonline.com/tenant-id/v2.0/authorize";
    private static final String TOKEN_ENDPOINT = "https://login.microsoftonline.com/tenant-id/v2.0/token";

    @Mock
    private OidcPluginAuthClient mockOidcClient;

    private PluginAuthResource resource;

    @BeforeEach
    void setup() throws Exception {
        resource = new PluginAuthResource();
        setField("oidcClient", mockOidcClient);
        setField("oidcAuthority", Optional.of(AUTH_SERVER_URL));
        setField("oidcClientId", Optional.of(CLIENT_ID));

        setField("oidcScopes", SCOPES);
        setField("hubBaseUrl", HUB_BASE_URL);
    }

    private void setField(String name, Object value) throws Exception {
        Field field = PluginAuthResource.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(resource, value);
    }

    // --- plugin-login tests ---

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_port_is_null() {
        Response response = resource.pluginLogin(null, null, null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("port parameter is required"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_port_is_blank() {
        Response response = resource.pluginLogin("  ", null, null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("port parameter is required"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_port_is_not_a_number() {
        Response response = resource.pluginLogin("abc", null, null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("valid number"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_port_is_zero() {
        Response response = resource.pluginLogin("0", null, null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("valid number"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_port_exceeds_65535() {
        Response response = resource.pluginLogin("70000", null, null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("valid number"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_503_when_oidc_authority_is_empty() throws Exception {
        setField("oidcAuthority", Optional.of(""));

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(503));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("OIDC is not configured"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_503_when_oidc_authority_is_absent() throws Exception {
        setField("oidcAuthority", Optional.empty());

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(503));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("OIDC is not configured"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_503_when_oidc_client_id_is_empty() throws Exception {
        setField("oidcClientId", Optional.of(""));

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(503));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("OIDC client-id is not configured"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_503_when_oidc_client_id_is_absent() throws Exception {
        setField("oidcClientId", Optional.empty());

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(503));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("OIDC client-id is not configured"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_502_when_oidc_discovery_fails() {
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(null);

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(502));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("Failed to discover OIDC endpoints"));
    }

    @Test
    void redirect_to_oidc_authorize_endpoint_on_success() {
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(307));
        URI location = (URI) response.getMetadata().getFirst("Location");
        assertThat(location, is(notNullValue()));
        String locationStr = location.toString();
        assertThat(locationStr, containsString(AUTHORIZATION_ENDPOINT));
        assertThat(locationStr, containsString("client_id=" + CLIENT_ID));
        assertThat(locationStr, containsString("response_type=code"));
        assertThat(locationStr, containsString("redirect_uri="));
        assertThat(locationStr, containsString("plugin-callback"));
        assertThat(locationStr, containsString("state="));
    }

    @Test
    void store_pending_session_on_login() {
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);

        resource.pluginLogin("63348", null, "test-nonce");

        assertThat(resource.getPendingSessions().isEmpty(), is(false));
        PluginAuthResource.PendingSession session =
                resource.getPendingSessions().values().iterator().next();
        assertThat(session.port(), equalTo("63348"));
        assertThat(session.redirectPath(), equalTo("/callback"));
    }

    @Test
    void use_custom_redirect_path_when_provided() {
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);

        resource.pluginLogin("63348", "/auth/done", "test-nonce");

        PluginAuthResource.PendingSession session =
                resource.getPendingSessions().values().iterator().next();
        assertThat(session.redirectPath(), equalTo("/auth/done"));
    }

    @Test
    void use_default_redirect_path_when_redirect_path_is_blank() {
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);

        resource.pluginLogin("63348", "  ", "test-nonce");

        PluginAuthResource.PendingSession session =
                resource.getPendingSessions().values().iterator().next();
        assertThat(session.redirectPath(), equalTo("/callback"));
    }

    @Test
    void accept_valid_port_at_boundary_1() {
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);

        Response response = resource.pluginLogin("1", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(307));
    }

    @Test
    void accept_valid_port_at_boundary_65535() {
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);

        Response response = resource.pluginLogin("65535", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(307));
    }

    // --- plugin-callback tests ---

    @Test
    @SuppressWarnings("unchecked")
    void return_502_when_idp_returns_error() {
        Response response = resource.pluginCallback("code", "state", "access_denied");

        assertThat(response.getStatus(), equalTo(502));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("Authentication failed at identity provider"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_callback_code_is_null() {
        Response response = resource.pluginCallback(null, "some-state", null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("Missing authorization code"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_callback_code_is_blank() {
        Response response = resource.pluginCallback("  ", "some-state", null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("Missing authorization code"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_callback_state_is_null() {
        Response response = resource.pluginCallback("valid-code", null, null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("Missing state parameter"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_callback_state_is_blank() {
        Response response = resource.pluginCallback("valid-code", "  ", null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("Missing state parameter"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_403_when_state_is_not_found_in_pending_sessions() {
        Response response = resource.pluginCallback("valid-code", "unknown-state", null);

        assertThat(response.getStatus(), equalTo(403));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("Invalid or expired state"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_503_when_oidc_authority_not_configured_on_callback() throws Exception {
        // Plant a valid pending session
        resource.getPendingSessions().put("valid-state",
                new PluginAuthResource.PendingSession("63348", "/callback", "test-verifier", "test-nonce"));
        setField("oidcAuthority", Optional.of(""));

        Response response = resource.pluginCallback("valid-code", "valid-state", null);

        assertThat(response.getStatus(), equalTo(503));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("OIDC is not configured"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_503_when_client_id_not_configured_on_callback() throws Exception {
        resource.getPendingSessions().put("valid-state",
                new PluginAuthResource.PendingSession("63348", "/callback", "test-verifier", "test-nonce"));
        setField("oidcClientId", Optional.of(""));

        Response response = resource.pluginCallback("valid-code", "valid-state", null);

        assertThat(response.getStatus(), equalTo(503));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("OIDC client-id is not configured"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_502_when_discovery_fails_on_callback() {
        resource.getPendingSessions().put("valid-state",
                new PluginAuthResource.PendingSession("63348", "/callback", "test-verifier", "test-nonce"));
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(null);

        Response response = resource.pluginCallback("valid-code", "valid-state", null);

        assertThat(response.getStatus(), equalTo(502));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("Failed to discover OIDC endpoints"));
    }

    @Test
    void return_html_with_plugin_redirect_on_successful_callback() {
        resource.getPendingSessions().put("valid-state",
                new PluginAuthResource.PendingSession("63348", "/callback", "test-verifier", "test-nonce"));
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);

        Response response = resource.pluginCallback("valid-code", "valid-state", null);

        assertThat(response.getStatus(), equalTo(200));
        String html = (String) response.getEntity();
        assertThat(html, containsString("http://localhost:63348/callback"));
        assertThat(html, containsString("code_verifier"));
        assertThat(html, containsString("test-verifier"));
    }

    @Test
    void return_html_with_custom_path_on_successful_callback() {
        resource.getPendingSessions().put("valid-state",
                new PluginAuthResource.PendingSession("9999", "/auth/done", "test-verifier", "test-nonce"));
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);

        Response response = resource.pluginCallback("valid-code", "valid-state", null);

        assertThat(response.getStatus(), equalTo(200));
        String html = (String) response.getEntity();
        assertThat(html, containsString("http://localhost:9999/auth/done"));
        assertThat(html, containsString("code_verifier"));
        assertThat(html, containsString("test-verifier"));
    }

    @Test
    void remove_state_from_pending_sessions_after_callback() {
        resource.getPendingSessions().put("valid-state",
                new PluginAuthResource.PendingSession("63348", "/callback", "test-verifier", "test-nonce"));
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);

        Response response = resource.pluginCallback("valid-code", "valid-state", null);

        assertThat(response.getStatus(), equalTo(200));
        assertThat(resource.getPendingSessions().containsKey("valid-state"), is(false));
    }

    @Test
    void return_400_for_negative_port() {
        Response response = resource.pluginLogin("-1", null, null);

        assertThat(response.getStatus(), equalTo(400));
    }
}
