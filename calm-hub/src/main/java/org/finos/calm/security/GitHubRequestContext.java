package org.finos.calm.security;

import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;

import java.util.Optional;

/**
 * Per-request holder for the decrypted GitHub session.
 * Lazily resolves the session from the encrypted cookie on first access,
 * using Vert.x RoutingContext (available during security checks, before JAX-RS).
 */
@RequestScoped
public class GitHubRequestContext {

    private static final String COOKIE_NAME = "calm_gh_session";

    @Inject
    GitHubSessionCookieService cookieService;

    @Inject
    SecurityIdentity identity;

    @Inject
    RoutingContext routingContext;

    private GitHubSessionCookieService.GitHubSession session;
    private boolean resolved;

    public Optional<String> getToken() {
        resolve();
        return session != null ? Optional.of(session.ghToken()) : Optional.empty();
    }

    public Optional<String> getUsername() {
        resolve();
        return session != null ? Optional.of(session.ghUsername()) : Optional.empty();
    }

    public boolean isLinked() {
        resolve();
        return session != null;
    }

    public void setSession(GitHubSessionCookieService.GitHubSession session) {
        this.session = session;
        this.resolved = true;
    }

    private void resolve() {
        if (resolved) {
            return;
        }
        resolved = true;

        if (!cookieService.isConfigured()) {
            return;
        }

        String cookieHeader = routingContext.request().getHeader("Cookie");
        String cookieValue = extractCookieValue(cookieHeader, COOKIE_NAME);
        if (cookieValue == null) {
            return;
        }

        if (identity == null || identity.isAnonymous()) {
            return;
        }

        Object sub = identity.getAttribute("sub");
        if (sub != null) {
            Optional<GitHubSessionCookieService.GitHubSession> result = cookieService.decrypt(cookieValue, sub.toString());
            if (result.isPresent()) {
                session = result.get();
                return;
            }
        }

        String principalName = identity.getPrincipal().getName();
        if (principalName != null && !principalName.isBlank()) {
            Optional<GitHubSessionCookieService.GitHubSession> result = cookieService.decrypt(cookieValue, principalName);
            result.ifPresent(s -> session = s);
        }
    }

    static String extractCookieValue(String cookieHeader, String name) {
        if (cookieHeader == null || cookieHeader.isBlank()) {
            return null;
        }
        for (String part : cookieHeader.split(";")) {
            String trimmed = part.trim();
            if (trimmed.startsWith(name + "=")) {
                String value = trimmed.substring(name.length() + 1);
                return value.isBlank() ? null : value;
            }
        }
        return null;
    }
}
