package org.finos.calm.resources;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.ws.rs.CookieParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.security.OidcPluginAuthClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import static org.finos.calm.resources.SearchResource.sanitizeForLog;

/**
 * Handles OIDC authentication on behalf of the VS Code plugin.
 * The plugin opens the /plugin-login URL in a browser; the Hub performs the
 * full OIDC authorization code flow and redirects back to the plugin's
 * localhost with the access token.
 *
 * <p>Both endpoints are public (no auth required) — the user has not yet
 * authenticated when they hit plugin-login, and plugin-callback receives
 * the IdP redirect. Because both are reachable by anyone, this class treats
 * every caller-suppliable value ({@code redirect_path}, {@code state},
 * {@code code}, the IdP {@code error} body) as untrusted:
 * <ul>
 *   <li>{@code redirect_path} is validated against a strict allowlist so it can
 *       never be used to redirect off {@code localhost} or break out of the
 *       eventual JS string/HTML context (see {@link #isValidRedirectPath}).</li>
 *   <li>The {@code state} lookup is bound to a random, {@code HttpOnly},
 *       {@code SameSite=Lax} cookie set on {@code /plugin-login} and checked on
 *       {@code /plugin-callback} — {@code state} alone is not treated as a
 *       secret, since {@code /plugin-login} is public and returns it in the
 *       redirect {@code Location} header to anyone who asks.</li>
 *   <li>Session lookup is non-destructive until the cookie check passes, and
 *       consumption is a single atomic {@code remove(state, session)} —
 *       an attacker who doesn't hold the matching cookie can neither read nor
 *       delete another session's pending state.</li>
 *   <li>Every value that reaches the callback HTML is carried through a
 *       {@code JSON.parse}-based data island, never string-concatenated into
 *       JavaScript or HTML.</li>
 * </ul>
 */
@Path("/api/calm/auth")
@Produces(MediaType.APPLICATION_JSON)
public class PluginAuthResource {

    private static final Logger LOG = LoggerFactory.getLogger(PluginAuthResource.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    static final String SESSION_COOKIE_NAME = "calm_plugin_auth_session";
    static final int SESSION_TTL_SECONDS = 600;
    private static final long SESSION_TTL_MILLIS = SESSION_TTL_SECONDS * 1000L;
    private static final int MAX_PENDING_SESSIONS = 10_000;
    private static final String DEFAULT_REDIRECT_PATH = "/callback";

    // Leading slash, then a bounded allowlist of path-safe characters. No "@" (blocks
    // http://localhost:port@attacker.example.com/ authority injection), no query/fragment
    // markers, and explicitly rejects "//" (protocol-relative) and ".." (traversal) below —
    // the character class alone doesn't rule those combinations out.
    private static final Pattern REDIRECT_PATH_PATTERN = Pattern.compile("^/[A-Za-z0-9._/-]{0,64}$");

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

    record PendingSession(String port, String redirectPath, String codeVerifier, String nonce,
                          String correlator, long expiresAtEpochMillis) {
        boolean isExpired(long nowEpochMillis) {
            return expiresAtEpochMillis <= nowEpochMillis;
        }
    }

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

        if (redirectPath != null && !redirectPath.isBlank() && !isValidRedirectPath(redirectPath)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "redirect_path must be a relative path beginning with '/'"))
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

        evictExpiredSessions();
        if (pendingSessions.size() >= MAX_PENDING_SESSIONS) {
            LOG.warn("Rejecting plugin-login: {} pending sessions already outstanding", pendingSessions.size());
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(Map.of("error", "Too many pending authentication sessions, try again shortly"))
                    .build();
        }

        String codeVerifier = randomUrlSafeToken(32);
        String codeChallenge;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(codeVerifier.getBytes(StandardCharsets.UTF_8));
            codeChallenge = Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", "SHA-256 not available")).build();
        }

        String state = UUID.randomUUID().toString();
        String correlator = randomUrlSafeToken(32);
        String effectiveRedirectPath = (redirectPath != null && !redirectPath.isBlank())
                ? redirectPath : DEFAULT_REDIRECT_PATH;
        long expiresAt = System.currentTimeMillis() + SESSION_TTL_MILLIS;
        pendingSessions.put(state, new PendingSession(port, effectiveRedirectPath, codeVerifier, nonce,
                correlator, expiresAt));

        String hubCallbackUrl = hubBaseUrl + "/api/calm/auth/plugin-callback";

        StringBuilder authorizeUrl = new StringBuilder(endpoints.authorizationEndpoint())
                .append("?client_id=").append(encode(oidcClientId.get()))
                .append("&response_type=code")
                .append("&scope=").append(encode(oidcScopes))
                .append("&redirect_uri=").append(encode(hubCallbackUrl))
                .append("&state=").append(encode(state))
                .append("&code_challenge=").append(encode(codeChallenge))
                .append("&code_challenge_method=S256");
        if (nonce != null && !nonce.isBlank()) {
            authorizeUrl.append("&nonce=").append(encode(nonce));
        }

        LOG.debug("Redirecting plugin auth to OIDC authorize endpoint for port {}", port);

        NewCookie sessionCookie = new NewCookie.Builder(SESSION_COOKIE_NAME)
                .value(correlator)
                .path("/api/calm/auth")
                .maxAge(SESSION_TTL_SECONDS)
                .httpOnly(true)
                .secure(hubBaseUrl.startsWith("https://"))
                .sameSite(NewCookie.SameSite.LAX)
                .build();

        return Response.temporaryRedirect(URI.create(authorizeUrl.toString()))
                .cookie(sessionCookie)
                .build();
    }

    @GET
    @Path("plugin-callback")
    public Response pluginCallback(@QueryParam("code") String code,
                                   @QueryParam("state") String state,
                                   @QueryParam("error") String error,
                                   @CookieParam(SESSION_COOKIE_NAME) String sessionCookie) {
        if (error != null && !error.isBlank()) {
            LOG.warn("OIDC IdP returned error: {}", sanitizeForLog(error));
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

        // Non-destructive lookup: an attacker without the matching cookie must not be
        // able to delete a victim's pending session by hitting this endpoint.
        PendingSession session = pendingSessions.get(state);
        if (session == null || session.isExpired(System.currentTimeMillis())) {
            if (session != null) {
                pendingSessions.remove(state, session);
            }
            LOG.warn("Invalid or expired state parameter in plugin callback");
            return Response.status(Response.Status.FORBIDDEN)
                    .entity(Map.of("error", "Invalid or expired state"))
                    .build();
        }

        if (sessionCookie == null || !constantTimeEquals(sessionCookie, session.correlator())) {
            LOG.warn("Plugin callback cookie missing or did not match the pending session");
            return Response.status(Response.Status.FORBIDDEN)
                    .entity(Map.of("error", "Invalid or expired state"))
                    .build();
        }

        // Single-use: only remove once the cookie has actually been validated, and only
        // if this exact session is still the one in the map (defends against a race with
        // a concurrent callback for the same state).
        if (!pendingSessions.remove(state, session)) {
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
        String pluginOrigin = "http://localhost:" + session.port();
        String tokenOrigin = originOf(endpoints.tokenEndpoint());
        String cspNonce = randomUrlSafeToken(16);

        String html = renderCallbackPage(new CallbackPageData(
                endpoints.tokenEndpoint(), oidcClientId.get(), code, hubCallbackUrl,
                session.codeVerifier(), pluginOrigin, session.redirectPath(), session.nonce()), cspNonce);

        return Response.ok(html)
                .type("text/html")
                .header("Content-Security-Policy", "script-src 'nonce-" + cspNonce + "'; "
                        + "connect-src " + tokenOrigin + "; base-uri 'none'; form-action 'none'")
                .header("Cache-Control", "no-store")
                .header("Referrer-Policy", "no-referrer")
                .build();
    }

    // Visible for testing
    Map<String, PendingSession> getPendingSessions() {
        return pendingSessions;
    }

    private void evictExpiredSessions() {
        long now = System.currentTimeMillis();
        pendingSessions.entrySet().removeIf(e -> e.getValue().isExpired(now));
    }

    private boolean isValidPort(String port) {
        try {
            int portNum = Integer.parseInt(port);
            return portNum >= 1 && portNum <= 65535;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * Strict allowlist for {@code redirect_path}: must already have matched
     * {@link #REDIRECT_PATH_PATTERN} (leading slash, bounded safe-character set) — this
     * additionally rejects a protocol-relative {@code //} prefix and any {@code ..}
     * traversal segment, neither of which the character class alone excludes.
     */
    private static boolean isValidRedirectPath(String path) {
        return REDIRECT_PATH_PATTERN.matcher(path).matches()
                && !path.startsWith("//")
                && !path.contains("..");
    }

    private static String randomUrlSafeToken(int byteLength) {
        byte[] bytes = new byte[byteLength];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private static String originOf(String url) {
        URI uri = URI.create(url);
        return uri.getScheme() + "://" + uri.getAuthority();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    /**
     * Everything the callback page's script needs, carried as a JSON data island rather
     * than interpolated into JavaScript/HTML — {@code code} in particular is IdP-supplied
     * and must never be concatenated into a script.
     */
    record CallbackPageData(String tokenEndpoint, String clientId, String code, String redirectUri,
                            String codeVerifier, String pluginOrigin, String redirectPath, String nonce) {}

    private static String renderCallbackPage(CallbackPageData data, String cspNonce) {
        String json;
        try {
            json = MAPPER.writeValueAsString(data);
        } catch (Exception e) {
            // Should be unreachable — every field is a String — but fail safe rather than
            // leak an unescaped value into the page if serialization ever does throw.
            throw new IllegalStateException("Failed to serialize plugin callback data", e);
        }
        return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Signing in&hellip;</title></head>"
                + "<body>"
                + "<p id=\"calm-plugin-auth-status\">Signing in&hellip;</p>"
                + "<script type=\"application/json\" id=\"calm-plugin-auth-data\">"
                + escapeForScriptEmbedding(json)
                + "</script>"
                + "<script nonce=\"" + cspNonce + "\">" + CALLBACK_SCRIPT + "</script>"
                + "</body></html>";
    }

    /**
     * Neutralises the sequences that could break out of the {@code <script>} element or
     * be interpreted as HTML — {@code <}, {@code >}, {@code &}, and the JS line-terminator
     * code points U+2028/U+2029, which are valid inside a JSON string but not inside a
     * plain (non-JS) HTML script body — per the OWASP-recommended JSON-data-island pattern.
     */
    private static String escapeForScriptEmbedding(String json) {
        return json.replace("<", "\\u003C")
                .replace(">", "\\u003E")
                .replace("&", "\\u0026")
                .replace(" ", "\\u2028")
                .replace(" ", "\\u2029");
    }

    // Constant script: no per-request interpolation at all. Reads the JSON data island,
    // performs the PKCE token exchange, verifies the returned ID token's nonce claim
    // against the nonce we sent the IdP (if any), and redirects to the plugin's localhost
    // callback — using textContent (never innerHTML) on every error path.
    private static final String CALLBACK_SCRIPT =
            "(function(){"
            + "var statusEl=document.getElementById('calm-plugin-auth-status');"
            + "function fail(message){statusEl.textContent=message;}"
            + "function decodeJwtPayload(jwt){"
            + "try{"
            + "var parts=jwt.split('.');"
            + "if(parts.length<2){return null;}"
            + "var b64=parts[1].replace(/-/g,'+').replace(/_/g,'/');"
            + "while(b64.length%4){b64+='=';}"
            + "return JSON.parse(atob(b64));"
            + "}catch(e){return null;}"
            + "}"
            + "var data;"
            + "try{data=JSON.parse(document.getElementById('calm-plugin-auth-data').textContent);}"
            + "catch(e){fail('Unable to read authentication data.');return;}"
            + "var body=new URLSearchParams({"
            + "grant_type:'authorization_code',"
            + "client_id:data.clientId,"
            + "code:data.code,"
            + "redirect_uri:data.redirectUri,"
            + "code_verifier:data.codeVerifier"
            + "});"
            + "fetch(data.tokenEndpoint,{"
            + "method:'POST',"
            + "headers:{'Content-Type':'application/x-www-form-urlencoded'},"
            + "body:body.toString()"
            + "}).then(function(res){"
            + "return res.text().then(function(text){"
            + "if(!res.ok){throw new Error(text);}"
            + "return JSON.parse(text);"
            + "});"
            + "}).then(function(tokenResponse){"
            + "var idToken=tokenResponse.id_token;"
            + "var token=idToken||tokenResponse.access_token;"
            + "if(!token){fail('No token received.');return;}"
            + "if(data.nonce&&idToken){"
            + "var payload=decodeJwtPayload(idToken);"
            + "if(!payload||payload.nonce!==data.nonce){fail('Nonce mismatch.');return;}"
            + "}"
            + "var target=data.pluginOrigin+data.redirectPath"
            + "+'?token='+encodeURIComponent(token)"
            + "+(data.nonce?'&nonce='+encodeURIComponent(data.nonce):'');"
            + "window.location.href=target;"
            + "}).catch(function(err){"
            + "fail('Token exchange failed: '+(err&&err.message?err.message:String(err)));"
            + "});"
            + "})();";
}
