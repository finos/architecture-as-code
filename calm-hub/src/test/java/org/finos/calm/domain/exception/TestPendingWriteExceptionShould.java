package org.finos.calm.domain.exception;

import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;

class TestPendingWriteExceptionShould {

    @Test
    void carry_pr_url() {
        PendingWriteException ex = new PendingWriteException("https://github.com/org/repo/pull/7", 7, "calm-hub/pattern-xyz");

        assertThat(ex.getPullRequestUrl(), equalTo("https://github.com/org/repo/pull/7"));
    }

    @Test
    void carry_pr_number() {
        PendingWriteException ex = new PendingWriteException("https://github.com/org/repo/pull/7", 7, "calm-hub/pattern-xyz");

        assertThat(ex.getPullRequestNumber(), equalTo(7));
    }

    @Test
    void carry_branch_name() {
        PendingWriteException ex = new PendingWriteException("https://github.com/org/repo/pull/7", 7, "calm-hub/pattern-xyz");

        assertThat(ex.getBranch(), equalTo("calm-hub/pattern-xyz"));
    }

    @Test
    void include_pr_number_in_message() {
        PendingWriteException ex = new PendingWriteException("https://github.com/org/repo/pull/42", 42, "branch");

        assertThat(ex.getMessage(), containsString("42"));
    }
}
