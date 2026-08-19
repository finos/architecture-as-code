package org.finos.calm.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubRequestContextShould {

    @Mock
    private GitHubSessionCookieService cookieService;

    private GitHubRequestContext context;

    @BeforeEach
    void setup() {
        context = new GitHubRequestContext(cookieService, null, null);
    }

    @Test
    void return_empty_when_no_session_set() {
        when(cookieService.isConfigured()).thenReturn(false);

        assertThat(context.isLinked(), is(false));
        assertThat(context.getToken().isPresent(), is(false));
        assertThat(context.getUsername().isPresent(), is(false));
    }

    @Test
    void return_values_when_session_is_set() {
        context.setSession(new GitHubSessionCookieService.GitHubSession(
                "gho_token", "alice", "sub-123", Instant.now().plusSeconds(3600)));

        assertThat(context.isLinked(), is(true));
        assertThat(context.getToken().get(), equalTo("gho_token"));
        assertThat(context.getUsername().get(), equalTo("alice"));
    }
}
