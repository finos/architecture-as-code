package org.finos.calm.store.github.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestGitHubForkPRServiceShould {

    private GitHubForkPRService service;

    @BeforeEach
    void setup() {
        service = new GitHubForkPRService();
    }

    @Test
    void throw_unsupported_until_oauth_flow_is_wired() {
        UnsupportedOperationException ex = assertThrows(UnsupportedOperationException.class,
                () -> service.createPullRequest(
                        "gho_token",
                        "finos/architecture-as-code",
                        "main",
                        "patterns/new-pattern.json",
                        "{\"nodes\": []}",
                        "feat: add new pattern"
                ));
        assertThat(ex.getMessage(), containsString("GitHub account linking"));
    }
}
