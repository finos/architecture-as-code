package org.finos.calm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.security.OidcPluginAuthClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Handles OIDC authentication on behalf of the VS Code plugin.
 * The plugin opens the /plugin-login URL in a browser; the Hub performs the
 * full OIDC authorization code flow and redirects back to the plugin's
 * localhost with the access token.
 *
 * Both endpoints are public (no auth required) — the user has not yet
 * authenticated when they hit plugin-login, and plugin-callback receives
 * the IdP redirect.
 */
@Path("/api/calm/auth")
@Produces(MediaType.APPLICATION_JSON)
public class PluginAuthResource {

    private static final Logger LOG = LoggerFactory.getLogger(PluginAuthResource.class);
    private static final String DEFAULT_REDIRECT_PATH = "/callback";

    private final Map<String, PendingSession> pendingSessions = new ConcurrentHashMap<>();

    @Inject
    OidcPluginAuthClient oidcClient;

    @Inject
    @ConfigProperty(name = "quarkus.oidc.auth-server-url", defaultValue = "")
    Optional<String> oidcAuthority;

    @Inject
    @ConfigProperty(name = "quarkus.oidc.client-id", defaultValue = "")
    Optional<String> oidcClientId;

    @Inject
    @ConfigProperty(name = "calm.oidc.scopes", defaultValue = "openid profile email")
    String oidcScopes;

    @Inject
    @ConfigProperty(name = "calm.hub.base-url", defaultValue = "http://localhost:8080")
    String hubBaseUrl;

    record PendingSession(String port, String redirectPath, String codeVerifier, String nonce) {}

    @GET
    @Path("plugin-login")
    public Response pluginLogin(@QueryParam("port") String port,
                                @QueryParam("redirect_path") String redirectPath,
                                @QueryParam("nonce") String nonce) {
        if (port == null || port.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "port parameter is required"))
                    .build();
        }

        if (!isValidPort(port)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "port must be a valid number between 1 and 65535"))
                    .build();
        }

        if (oidcAuthority.isEmpty() || oidcAuthority.get().isBlank()) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(Map.of("error", "OIDC is not configured"))
                    .build();
        }

        if (oidcClientId.isEmpty() || oidcClientId.get().isBlank()) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(Map.of("error", "OIDC client-id is not configured"))
                    .build();
        }

        OidcPluginAuthClient.OidcEndpoints endpoints = oidcClient.discoverEndpoints(oidcAuthority.get());
        if (endpoints == null) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of("error", "Failed to discover OIDC endpoints"))
                    .build();
        }

        byte[] verifierBytes = new byte[32];
        new java.security.SecureRandom().nextBytes(verifierBytes);
        String codeVerifier = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(verifierBytes);
        String codeChallenge;
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(codeVerifier.getBytes(StandardCharsets.UTF_8));
            codeChallenge = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (java.security.NoSuchAlgorithmException e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", "SHA-256 not available")).build();
        }

        String state = UUID.randomUUID().toString();
        String effectiveRedirectPath = (redirectPath != null && !redirectPath.isBlank())
                ? redirectPath : DEFAULT_REDIRECT_PATH;
        pendingSessions.put(state, new PendingSession(port, effectiveRedirectPath, codeVerifier, nonce));

        String hubCallbackUrl = hubBaseUrl + "/api/calm/auth/plugin-callback";

        String authorizeUrl = endpoints.authorizationEndpoint()
                + "?client_id=" + encode(oidcClientId.get())
                + "&response_type=code"
                + "&scope=" + encode(oidcScopes)
                + "&redirect_uri=" + encode(hubCallbackUrl)
                + "&state=" + encode(state)
                + "&code_challenge=" + encode(codeChallenge)
                + "&code_challenge_method=S256";

        LOG.debug("Redirecting plugin auth to OIDC authorize endpoint for port {}", port);

        return Response.temporaryRedirect(URI.create(authorizeUrl)).build();
    }

    @GET
    @Path("plugin-callback")
    public Response pluginCallback(@QueryParam("code") String code,
                                   @QueryParam("state") String state,
                                   @QueryParam("error") String error) {
        if (error != null && !error.isBlank()) {
            LOG.warn("OIDC IdP returned error: {}", error);
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of("error", "Authentication failed at identity provider"))
                    .build();
        }

        if (code == null || code.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Missing authorization code"))
                    .build();
        }

        if (state == null || state.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Missing state parameter"))
                    .build();
        }

        PendingSession session = pendingSessions.remove(state);
        if (session == null) {
            LOG.warn("Invalid or expired state parameter in plugin callback");
            return Response.status(Response.Status.FORBIDDEN)
                    .entity(Map.of("error", "Invalid or expired state"))
                    .build();
        }

        if (oidcAuthority.isEmpty() || oidcAuthority.get().isBlank()) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(Map.of("error", "OIDC is not configured"))
                    .build();
        }

        if (oidcClientId.isEmpty() || oidcClientId.get().isBlank()) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(Map.of("error", "OIDC client-id is not configured"))
                    .build();
        }

        OidcPluginAuthClient.OidcEndpoints endpoints = oidcClient.discoverEndpoints(oidcAuthority.get());
        if (endpoints == null) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of("error", "Failed to discover OIDC endpoints"))
                    .build();
        }

        String hubCallbackUrl = hubBaseUrl + "/api/calm/auth/plugin-callback";
        String pluginRedirect = "http://localhost:" + session.port() + session.redirectPath();
        String nonceParam = session.nonce() != null ? "&nonce=" + encode(session.nonce()) : "";

        String html = "<!DOCTYPE html><html><body><h2>Signing in...</h2><script>"
                + "(async()=>{"
                + "try{"
                + "const body=new URLSearchParams({"
                + "grant_type:'authorization_code',"
                + "client_id:'" + oidcClientId.get() + "',"
                + "code:'" + code + "',"
                + "redirect_uri:'" + hubCallbackUrl + "',"
                + "code_verifier:'" + session.codeVerifier() + "'"
                + "});"
                + "const res=await fetch('" + endpoints.tokenEndpoint() + "',{"
                + "method:'POST',"
                + "headers:{'Content-Type':'application/x-www-form-urlencoded'},"
                + "body:body.toString()"
                + "});"
                + "if(!res.ok){const e=await res.text();document.body.innerHTML='<h2>Token exchange failed</h2><p>'+e+'</p>';return;}"
                + "const data=await res.json();"
                + "const token=data.id_token||data.access_token;"
                + "if(token){window.location.href='" + pluginRedirect + "?token='+encodeURIComponent(token)+'" + nonceParam + "';}"
                + "else{document.body.innerHTML='<h2>No token received</h2>';}"
                + "}catch(e){document.body.innerHTML='<h2>Error</h2><p>'+e.message+'</p>';}"
                + "})();"
                + "</script></body></html>";

        return Response.ok(html).type("text/html").build();
    }

    // Visible for testing
    Map<String, PendingSession> getPendingSessions() {
        return pendingSessions;
    }

    private boolean isValidPort(String port) {
        try {
            int portNum = Integer.parseInt(port);
            return portNum >= 1 && portNum <= 65535;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
