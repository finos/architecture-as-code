package org.finos.calm.resources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.NewCookie;
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
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestPluginAuthResourceShould {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String AUTH_SERVER_URL = "https://login.microsoftonline.com/tenant-id/v2.0";
    private static final String CLIENT_ID = "calm-hub-client";
    private static final String HUB_BASE_URL = "http://localhost:8080";
    private static final String SCOPES = "openid profile email";
    private static final String AUTHORIZATION_ENDPOINT = "https://login.microsoftonline.com/tenant-id/v2.0/authorize";
    private static final String TOKEN_ENDPOINT = "https://login.microsoftonline.com/tenant-id/v2.0/token";
    private static final String CORRELATOR = "test-correlator";

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

    private void stubDiscovery() {
        OidcPluginAuthClient.OidcEndpoints endpoints =
                new OidcPluginAuthClient.OidcEndpoints(AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(endpoints);
    }

    private void plantSession(String state, String port, String redirectPath, String correlator) {
        long farFuture = System.currentTimeMillis() + 600_000L;
        resource.getPendingSessions().put(state,
                new PluginAuthResource.PendingSession(port, redirectPath, "test-verifier", "test-nonce",
                        correlator, farFuture));
    }

    private void plantExpiredSession(String state, String correlator) {
        long past = System.currentTimeMillis() - 1000L;
        resource.getPendingSessions().put(state,
                new PluginAuthResource.PendingSession("63348", "/callback", "test-verifier", "test-nonce",
                        correlator, past));
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
    void return_400_for_negative_port() {
        Response response = resource.pluginLogin("-1", null, null);

        assertThat(response.getStatus(), equalTo(400));
    }

    // --- redirect_path validation ---

    @Test
    @SuppressWarnings("unchecked")
    void return_400_when_redirect_path_contains_traversal() {
        Response response = resource.pluginLogin("63348", "/../../etc/passwd", null);

        assertThat(response.getStatus(), equalTo(400));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("redirect_path"));
    }

    @Test
    void return_400_when_redirect_path_is_protocol_relative() {
        Response response = resource.pluginLogin("63348", "//evil.example.com/steal", null);

        assertThat(response.getStatus(), equalTo(400));
    }

    @Test
    void return_400_when_redirect_path_contains_authority_injection_char() {
        // The classic http://localhost:<port>@evil.example.com/ browser-parses-as-userinfo trick.
        Response response = resource.pluginLogin("63348", "@evil.example.com/", null);

        assertThat(response.getStatus(), equalTo(400));
    }

    @Test
    void return_400_when_redirect_path_does_not_start_with_slash() {
        Response response = resource.pluginLogin("63348", "callback", null);

        assertThat(response.getStatus(), equalTo(400));
    }

    @Test
    void return_400_when_redirect_path_contains_script_breakout_characters() {
        Response response = resource.pluginLogin("63348", "/'-alert(1)-'", null);

        assertThat(response.getStatus(), equalTo(400));
    }

    @Test
    void return_503_when_oidc_authority_is_empty() throws Exception {
        setField("oidcAuthority", Optional.of(""));

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(503));
    }

    @Test
    void return_503_when_oidc_authority_is_absent() throws Exception {
        setField("oidcAuthority", Optional.empty());

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(503));
    }

    @Test
    void return_503_when_oidc_client_id_is_empty() throws Exception {
        setField("oidcClientId", Optional.of(""));

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(503));
    }

    @Test
    void return_502_when_oidc_discovery_fails() {
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(null);

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(502));
    }

    @Test
    void redirect_to_oidc_authorize_endpoint_on_success() {
        stubDiscovery();

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
        assertThat(locationStr, containsString("nonce=test-nonce"));
    }

    @Test
    void omit_nonce_from_authorize_url_when_not_supplied() {
        stubDiscovery();

        Response response = resource.pluginLogin("63348", null, null);

        URI location = (URI) response.getMetadata().getFirst("Location");
        assertThat(location.toString(), not(containsString("nonce=")));
    }

    @Test
    void set_a_httponly_samesite_lax_session_cookie_on_login() {
        stubDiscovery();

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        NewCookie cookie = (NewCookie) response.getMetadata().getFirst("Set-Cookie");
        assertThat(cookie, is(notNullValue()));
        String header = cookie.toString();
        assertThat(header, allOf(
                containsString("calm_plugin_auth_session="),
                containsString("HttpOnly"),
                containsString("SameSite=Lax")));
        assertThat(cookie.getMaxAge(), equalTo(PluginAuthResource.SESSION_TTL_SECONDS));
    }

    @Test
    void store_pending_session_with_correlator_matching_the_cookie_on_login() {
        stubDiscovery();

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        NewCookie cookie = (NewCookie) response.getMetadata().getFirst("Set-Cookie");
        assertThat(resource.getPendingSessions().isEmpty(), is(false));
        PluginAuthResource.PendingSession session =
                resource.getPendingSessions().values().iterator().next();
        assertThat(session.port(), equalTo("63348"));
        assertThat(session.redirectPath(), equalTo("/callback"));
        assertThat(session.correlator(), equalTo(cookie.getValue()));
    }

    @Test
    void use_custom_redirect_path_when_provided() {
        stubDiscovery();

        resource.pluginLogin("63348", "/auth/done", "test-nonce");

        PluginAuthResource.PendingSession session =
                resource.getPendingSessions().values().iterator().next();
        assertThat(session.redirectPath(), equalTo("/auth/done"));
    }

    @Test
    void use_default_redirect_path_when_redirect_path_is_blank() {
        stubDiscovery();

        resource.pluginLogin("63348", "  ", "test-nonce");

        PluginAuthResource.PendingSession session =
                resource.getPendingSessions().values().iterator().next();
        assertThat(session.redirectPath(), equalTo("/callback"));
    }

    @Test
    void accept_valid_port_at_boundary_1() {
        stubDiscovery();

        Response response = resource.pluginLogin("1", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(307));
    }

    @Test
    void accept_valid_port_at_boundary_65535() {
        stubDiscovery();

        Response response = resource.pluginLogin("65535", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(307));
    }

    @Test
    void reject_new_logins_once_the_pending_session_cap_is_reached() throws Exception {
        stubDiscovery();
        long farFuture = System.currentTimeMillis() + 600_000L;
        for (int i = 0; i < 10_000; i++) {
            resource.getPendingSessions().put("state-" + i,
                    new PluginAuthResource.PendingSession("1", "/callback", "v", null, "c", farFuture));
        }

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(503));
    }

    @Test
    void evict_expired_sessions_before_enforcing_the_cap() {
        stubDiscovery();
        long past = System.currentTimeMillis() - 1000L;
        for (int i = 0; i < 10_000; i++) {
            resource.getPendingSessions().put("expired-" + i,
                    new PluginAuthResource.PendingSession("1", "/callback", "v", null, "c", past));
        }

        Response response = resource.pluginLogin("63348", null, "test-nonce");

        assertThat(response.getStatus(), equalTo(307));
    }

    // --- plugin-callback tests ---

    @Test
    @SuppressWarnings("unchecked")
    void return_502_when_idp_returns_error() {
        Response response = resource.pluginCallback("code", "state", "access_denied", null);

        assertThat(response.getStatus(), equalTo(502));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), containsString("Authentication failed at identity provider"));
    }

    @Test
    void return_400_when_callback_code_is_null() {
        Response response = resource.pluginCallback(null, "some-state", null, null);

        assertThat(response.getStatus(), equalTo(400));
    }

    @Test
    void return_400_when_callback_state_is_null() {
        Response response = resource.pluginCallback("valid-code", null, null, null);

        assertThat(response.getStatus(), equalTo(400));
    }

    @Test
    void return_403_when_state_is_not_found_in_pending_sessions() {
        Response response = resource.pluginCallback("valid-code", "unknown-state", null, CORRELATOR);

        assertThat(response.getStatus(), equalTo(403));
    }

    @Test
    void return_403_when_session_has_expired() {
        plantExpiredSession("valid-state", CORRELATOR);

        Response response = resource.pluginCallback("valid-code", "valid-state", null, CORRELATOR);

        assertThat(response.getStatus(), equalTo(403));
    }

    @Test
    void return_403_when_cookie_is_missing() {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);

        Response response = resource.pluginCallback("valid-code", "valid-state", null, null);

        assertThat(response.getStatus(), equalTo(403));
    }

    @Test
    void return_403_when_cookie_does_not_match_the_session_correlator() {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);

        Response response = resource.pluginCallback("valid-code", "valid-state", null, "wrong-correlator");

        assertThat(response.getStatus(), equalTo(403));
    }

    @Test
    void not_consume_the_session_when_the_cookie_check_fails() {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);

        resource.pluginCallback("valid-code", "valid-state", null, "wrong-correlator");

        assertThat(resource.getPendingSessions().containsKey("valid-state"), is(true));
    }

    @Test
    void not_consume_the_session_when_the_cookie_is_missing() {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);

        resource.pluginCallback("valid-code", "valid-state", null, null);

        assertThat(resource.getPendingSessions().containsKey("valid-state"), is(true));
    }

    @Test
    void return_503_when_oidc_authority_not_configured_on_callback() throws Exception {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);
        setField("oidcAuthority", Optional.of(""));

        Response response = resource.pluginCallback("valid-code", "valid-state", null, CORRELATOR);

        assertThat(response.getStatus(), equalTo(503));
    }

    @Test
    void return_502_when_discovery_fails_on_callback() {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);
        when(mockOidcClient.discoverEndpoints(AUTH_SERVER_URL)).thenReturn(null);

        Response response = resource.pluginCallback("valid-code", "valid-state", null, CORRELATOR);

        assertThat(response.getStatus(), equalTo(502));
    }

    @Test
    void return_html_with_a_json_data_island_carrying_the_plugin_redirect_on_success() throws Exception {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);
        stubDiscovery();

        Response response = resource.pluginCallback("valid-code", "valid-state", null, CORRELATOR);

        assertThat(response.getStatus(), equalTo(200));
        String html = (String) response.getEntity();
        JsonNode data = extractDataIsland(html);
        assertThat(data.get("pluginOrigin").asText(), equalTo("http://localhost:63348"));
        assertThat(data.get("redirectPath").asText(), equalTo("/callback"));
        assertThat(data.get("codeVerifier").asText(), equalTo("test-verifier"));
        assertThat(data.get("code").asText(), equalTo("valid-code"));
    }

    @Test
    void never_concatenate_an_injected_code_value_unescaped_into_the_page() throws Exception {
        String maliciousCode = "</script><script>alert(document.domain)</script>";
        plantSession("valid-state", "63348", "/callback", CORRELATOR);
        stubDiscovery();

        Response response = resource.pluginCallback(maliciousCode, "valid-state", null, CORRELATOR);

        String html = (String) response.getEntity();
        assertThat(html, not(containsString("</script><script>alert(document.domain)</script>")));
        JsonNode data = extractDataIsland(html);
        assertThat(data.get("code").asText(), equalTo(maliciousCode));
    }

    @Test
    void set_a_strict_content_security_policy_cache_control_and_referrer_policy_on_the_callback_page() {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);
        stubDiscovery();

        Response response = resource.pluginCallback("valid-code", "valid-state", null, CORRELATOR);

        String csp = (String) response.getMetadata().getFirst("Content-Security-Policy");
        assertThat(csp, allOf(
                containsString("script-src 'nonce-"),
                containsString("connect-src https://login.microsoftonline.com"),
                containsString("base-uri 'none'"),
                containsString("form-action 'none'")));
        assertThat(response.getMetadata().getFirst("Cache-Control"), equalTo("no-store"));
        assertThat(response.getMetadata().getFirst("Referrer-Policy"), equalTo("no-referrer"));
    }

    @Test
    void remove_state_from_pending_sessions_after_a_successful_callback() {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);
        stubDiscovery();

        Response response = resource.pluginCallback("valid-code", "valid-state", null, CORRELATOR);

        assertThat(response.getStatus(), equalTo(200));
        assertThat(resource.getPendingSessions().containsKey("valid-state"), is(false));
    }

    @Test
    void reject_reuse_of_an_already_consumed_state() {
        plantSession("valid-state", "63348", "/callback", CORRELATOR);
        stubDiscovery();
        resource.pluginCallback("valid-code", "valid-state", null, CORRELATOR);

        Response second = resource.pluginCallback("valid-code", "valid-state", null, CORRELATOR);

        assertThat(second.getStatus(), equalTo(403));
    }

    private JsonNode extractDataIsland(String html) throws Exception {
        String marker = "id=\"calm-plugin-auth-data\">";
        int start = html.indexOf(marker) + marker.length();
        int end = html.indexOf("</script>", start);
        String json = html.substring(start, end);
        return MAPPER.readTree(json);
    }
}
