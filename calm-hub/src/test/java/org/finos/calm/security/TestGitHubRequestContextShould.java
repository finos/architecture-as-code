package org.finos.calm.security;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

class TestGitHubRequestContextShould {

    @Test
    void return_empty_when_no_session_set() {
        GitHubRequestContext context = new GitHubRequestContext();

        assertThat(context.isLinked(), is(false));
        assertThat(context.getToken().isPresent(), is(false));
        assertThat(context.getUsername().isPresent(), is(false));
    }

    @Test
    void return_values_when_session_is_set() {
        GitHubRequestContext context = new GitHubRequestContext();
        context.setSession(new GitHubSessionCookieService.GitHubSession(
                "gho_token", "alice", "sub-123", Instant.now().plusSeconds(3600)));

        assertThat(context.isLinked(), is(true));
        assertThat(context.getToken().get(), equalTo("gho_token"));
        assertThat(context.getUsername().get(), equalTo("alice"));
    }
}
