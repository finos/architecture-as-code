package org.finos.calm.security;

import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.core.http.Cookie;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.ext.web.RoutingContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.time.Instant;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubRequestContextFilterShould {

    @Mock
    private GitHubSessionCookieService cookieService;

    @Mock
    private SecurityIdentity identity;

    @Mock
    private RoutingContext routingContext;

    @Mock
    private HttpServerRequest httpRequest;

    @Mock
    private Principal principal;

    private GitHubRequestContext context;

    @BeforeEach
    void setup() {
        context = new GitHubRequestContext();
        context.cookieService = cookieService;
        context.identity = identity;
        context.routingContext = routingContext;
    }

    private void mockCookie(String value) {
        Cookie cookie = Cookie.cookie("calm_gh_session", value);
        when(routingContext.request()).thenReturn(httpRequest);
        when(httpRequest.getCookie("calm_gh_session")).thenReturn(cookie);
    }

    private void mockNoCookie() {
        when(routingContext.request()).thenReturn(httpRequest);
        when(httpRequest.getCookie("calm_gh_session")).thenReturn(null);
    }

    @Test
    void resolve_session_using_sub_claim() {
        mockCookie("encrypted-value");
        when(cookieService.isConfigured()).thenReturn(true);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getAttribute("sub")).thenReturn("oidc-sub-123");

        GitHubSessionCookieService.GitHubSession session =
                new GitHubSessionCookieService.GitHubSession("gho_token", "user1", "oidc-sub-123", Instant.now().plusSeconds(3600));
        when(cookieService.decrypt("encrypted-value", "oidc-sub-123")).thenReturn(Optional.of(session));

        assertThat(context.isLinked(), is(true));
        assertThat(context.getToken().orElse(""), is("gho_token"));
        assertThat(context.getUsername().orElse(""), is("user1"));
    }

    @Test
    void resolve_session_using_principal_name_fallback() {
        mockCookie("encrypted-value");
        when(cookieService.isConfigured()).thenReturn(true);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getAttribute("sub")).thenReturn("oidc-sub-different");
        when(cookieService.decrypt("encrypted-value", "oidc-sub-different")).thenReturn(Optional.empty());
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("testuser@company.com");

        GitHubSessionCookieService.GitHubSession session =
                new GitHubSessionCookieService.GitHubSession("gho_token", "user1", "testuser@company.com", Instant.now().plusSeconds(3600));
        when(cookieService.decrypt("encrypted-value", "testuser@company.com")).thenReturn(Optional.of(session));

        assertThat(context.isLinked(), is(true));
        assertThat(context.getToken().orElse(""), is("gho_token"));
    }

    @Test
    void return_not_linked_when_no_cookie() {
        mockNoCookie();
        when(cookieService.isConfigured()).thenReturn(true);

        assertThat(context.isLinked(), is(false));
        assertThat(context.getToken().isPresent(), is(false));
    }

    @Test
    void return_not_linked_when_identity_is_anonymous() {
        mockCookie("encrypted-value");
        when(cookieService.isConfigured()).thenReturn(true);
        when(identity.isAnonymous()).thenReturn(true);

        assertThat(context.isLinked(), is(false));
    }

    @Test
    void return_not_linked_when_decrypt_fails() {
        mockCookie("invalid-value");
        when(cookieService.isConfigured()).thenReturn(true);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getAttribute("sub")).thenReturn("oidc-sub-123");
        when(cookieService.decrypt("invalid-value", "oidc-sub-123")).thenReturn(Optional.empty());
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("user");
        when(cookieService.decrypt("invalid-value", "user")).thenReturn(Optional.empty());

        assertThat(context.isLinked(), is(false));
        assertThat(context.getToken().isPresent(), is(false));
    }

    @Test
    void return_not_linked_when_cookie_service_not_configured() {
        when(cookieService.isConfigured()).thenReturn(false);

        assertThat(context.isLinked(), is(false));
    }

    @Test
    void resolve_only_once_and_cache_result() {
        mockCookie("encrypted-value");
        when(cookieService.isConfigured()).thenReturn(true);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getAttribute("sub")).thenReturn("oidc-sub-123");

        GitHubSessionCookieService.GitHubSession session =
                new GitHubSessionCookieService.GitHubSession("gho_token", "user1", "oidc-sub-123", Instant.now().plusSeconds(3600));
        when(cookieService.decrypt("encrypted-value", "oidc-sub-123")).thenReturn(Optional.of(session));

        context.isLinked();
        context.getToken();
        context.getUsername();

        verify(cookieService, times(1)).decrypt("encrypted-value", "oidc-sub-123");
    }

    @Test
    void respect_explicit_session_set() {
        GitHubSessionCookieService.GitHubSession session =
                new GitHubSessionCookieService.GitHubSession("manual-token", "manual-user", "sub", Instant.now().plusSeconds(3600));
        context.setSession(session);

        assertThat(context.isLinked(), is(true));
        assertThat(context.getToken().orElse(""), is("manual-token"));
        assertThat(context.getUsername().orElse(""), is("manual-user"));
    }
}
