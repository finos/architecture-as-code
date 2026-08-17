package org.finos.calm.resources;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.CookieParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.security.GitHubSessionCookieService;
import io.quarkus.security.identity.SecurityIdentity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.Optional;

/**
 * GitHub OAuth account linking endpoints.
 * /link redirects to GitHub OAuth, /callback handles the return,
 * /status reports link state, /unlink clears the session.
 */
@Path("/api/calm/github")
@Produces(MediaType.APPLICATION_JSON)
public class GitHubLinkResource {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubLinkResource.class);
    private static final String COOKIE_NAME = "calm_gh_session";

    @Inject
    GitHubSessionCookieService cookieService;

    @Inject
    SecurityIdentity identity;

    @Inject
    @ConfigProperty(name = "calm.github.oauth.client-id", defaultValue = "")
    Optional<String> githubClientId;

    @Inject
    @ConfigProperty(name = "calm.github.oauth.client-secret", defaultValue = "")
    Optional<String> githubClientSecret;

    @Inject
    @ConfigProperty(name = "calm.github.oauth.scope", defaultValue = "repo")
    String githubScope;

    @Inject
    @ConfigProperty(name = "calm.github.oauth.base-url", defaultValue = "https://github.com")
    String githubBaseUrl;

    @GET
    @Path("/link")
    public Response link(@QueryParam("user") String user) {
        if (githubClientId.isEmpty() || githubClientId.get().isBlank()) {
            return Response.status(501)
                    .entity(Map.of("error", "GitHub OAuth is not configured"))
                    .build();
        }
        String state = user != null ? user : "unknown";
        String authorizeUrl = githubBaseUrl + "/login/oauth/authorize"
                + "?client_id=" + githubClientId.get()
                + "&scope=" + githubScope
                + "&state=" + state;
        return Response.temporaryRedirect(URI.create(authorizeUrl)).build();
    }

    @GET
    @Path("/callback")
    public Response callback(@QueryParam("code") String code, @QueryParam("state") String state) {
        if (code == null || code.isBlank()) {
            return Response.status(400)
                    .entity(Map.of("error", "Missing authorization code"))
                    .build();
        }
        if (githubClientId.isEmpty() || githubClientSecret.isEmpty()) {
            return Response.status(501)
                    .entity(Map.of("error", "GitHub OAuth client-id or client-secret not configured"))
                    .build();
        }

        try {
            String tokenUrl = githubBaseUrl + "/login/oauth/access_token";
            String body = "client_id=" + githubClientId.get()
                    + "&client_secret=" + githubClientSecret.get()
                    + "&code=" + code;

            HttpClient client = HttpClient.newBuilder().proxy(ProxySelector.getDefault()).build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(tokenUrl))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOG.error("GitHub token exchange failed with status {}: {}", response.statusCode(), response.body());
                return Response.status(502)
                        .entity(Map.of("error", "GitHub token exchange failed"))
                        .build();
            }

            String responseBody = response.body();
            String ghToken = extractJsonField(responseBody, "access_token");
            if (ghToken == null || ghToken.isBlank()) {
                LOG.error("No access_token in GitHub response: {}", responseBody);
                return Response.status(502)
                        .entity(Map.of("error", "No access token in GitHub response"))
                        .build();
            }

            String ghUsername = fetchGitHubUsername(ghToken);
            String oidcSub = (state != null && !state.isBlank()) ? state : "unknown";

            String cookieValue = cookieService.encrypt(ghToken, ghUsername, oidcSub);
            NewCookie sessionCookie = new NewCookie.Builder(COOKIE_NAME)
                    .value(cookieValue)
                    .path("/api/calm")
                    .maxAge(cookieService.getSessionTtlSeconds())
                    .httpOnly(true)
                    .secure(false) // false for localhost testing; true in production
                    .build();

            return Response.temporaryRedirect(URI.create("/"))
                    .cookie(sessionCookie)
                    .build();
        } catch (Exception e) {
            LOG.error("GitHub OAuth callback failed", e);
            return Response.status(500)
                    .entity(Map.of("error", "GitHub OAuth callback failed: " + e.getMessage()))
                    .build();
        }
    }

    private String fetchGitHubUsername(String token) {
        try {
            HttpClient client = HttpClient.newBuilder().proxy(ProxySelector.getDefault()).build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.github.com/user"))
                    .header("Authorization", "Bearer " + token)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return extractJsonField(response.body(), "login");
        } catch (Exception e) {
            LOG.warn("Could not fetch GitHub username: {}", e.getMessage());
            return "unknown";
        }
    }

    private String extractJsonField(String json, String field) {
        String search = "\"" + field + "\":\"";
        int start = json.indexOf(search);
        if (start < 0) return null;
        start += search.length();
        int end = json.indexOf("\"", start);
        if (end < 0) return null;
        return json.substring(start, end);
    }

    @GET
    @Path("/status")
    @Authenticated
    public Response status(@CookieParam(COOKIE_NAME) String cookie) {
        if (!cookieService.isConfigured()) {
            return Response.ok(Map.of("linked", false, "reason", "session key not configured")).build();
        }

        String oidcSub = getOidcSub();
        Optional<GitHubSessionCookieService.GitHubSession> session = cookieService.decrypt(cookie, oidcSub);

        if (session.isPresent()) {
            return Response.ok(Map.of(
                    "linked", true,
                    "username", session.get().ghUsername()
            )).build();
        }
        return Response.ok(Map.of("linked", false)).build();
    }

    @POST
    @Path("/unlink")
    @Authenticated
    public Response unlink() {
        NewCookie expiredCookie = new NewCookie.Builder(COOKIE_NAME)
                .value("")
                .path("/api/calm")
                .maxAge(0)
                .httpOnly(true)
                .secure(true)
                .build();
        return Response.ok(Map.of("linked", false))
                .cookie(expiredCookie)
                .build();
    }

    private String getOidcSub() {
        Object sub = identity.getAttribute("sub");
        return sub != null ? sub.toString() : identity.getPrincipal().getName();
    }
}
