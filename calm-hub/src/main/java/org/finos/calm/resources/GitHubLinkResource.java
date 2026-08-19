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
import org.finos.calm.security.GitHubOAuthClient;
import org.finos.calm.security.GitHubSessionCookieService;
import io.quarkus.security.identity.SecurityIdentity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.util.Map;
import java.util.Optional;

/**
 * GitHub OAuth account linking endpoints.
 * /link returns the authorize URL (requires OIDC auth), /callback handles the return,
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
    GitHubOAuthClient oauthClient;

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

    @Inject
    @ConfigProperty(name = "calm.github.cookie.secure", defaultValue = "true")
    boolean cookieSecure;

    @GET
    @Path("/link")
    @Authenticated
    public Response link() {
        if (githubClientId.isEmpty() || githubClientId.get().isBlank()) {
            return Response.status(501)
                    .entity(Map.of("error", "GitHub OAuth is not configured"))
                    .build();
        }
        if (!cookieService.isConfigured()) {
            return Response.status(501)
                    .entity(Map.of("error", "Session key not configured"))
                    .build();
        }
        String oidcSub = getOidcSub();
        String state = cookieService.createOAuthState(oidcSub);
        String authorizeUrl = githubBaseUrl + "/login/oauth/authorize"
                + "?client_id=" + githubClientId.get()
                + "&scope=" + githubScope
                + "&state=" + state;
        return Response.ok(Map.of("authorizeUrl", authorizeUrl)).build();
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

        Optional<String> verifiedSub = cookieService.verifyOAuthState(state);
        if (verifiedSub.isEmpty()) {
            LOG.warn("Invalid or expired OAuth state in callback");
            return Response.status(403)
                    .entity(Map.of("error", "Invalid or expired OAuth state"))
                    .build();
        }

        GitHubOAuthClient.TokenResponse tokenResponse =
                oauthClient.exchangeCode(githubClientId.get(), githubClientSecret.get(), code);

        if (tokenResponse.accessToken() == null) {
            return Response.status(502)
                    .entity(Map.of("error", tokenResponse.error()))
                    .build();
        }

        String ghUsername = oauthClient.fetchUsername(tokenResponse.accessToken());
        String oidcSub = verifiedSub.get();

        String cookieValue = cookieService.encrypt(tokenResponse.accessToken(), ghUsername, oidcSub);
        NewCookie sessionCookie = new NewCookie.Builder(COOKIE_NAME)
                .value(cookieValue)
                .path("/api/calm")
                .maxAge(cookieService.getSessionTtlSeconds())
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(NewCookie.SameSite.LAX)
                .build();

        return Response.temporaryRedirect(URI.create("/"))
                .cookie(sessionCookie)
                .build();
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
                .secure(cookieSecure)
                .sameSite(NewCookie.SameSite.LAX)
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
