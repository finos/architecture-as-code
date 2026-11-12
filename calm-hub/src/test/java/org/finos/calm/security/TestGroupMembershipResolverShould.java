package org.finos.calm.security;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class TestGroupMembershipResolverShould {

    private static final Set<String> ALICE_GROUPS = Set.of("architects", "reviewers");

    private final GroupMembershipResolver resolver = (username, groups) -> groups.stream()
            .filter(group -> "alice".equals(username) && ALICE_GROUPS.contains(group))
            .collect(Collectors.toSet());

    @Test
    void report_membership_of_one_group_through_member_groups() {
        assertThat(resolver.isMember("alice", "architects"), is(true));
        assertThat(resolver.isMember("alice", "operators"), is(false));
        assertThat(resolver.isMember("bob", "architects"), is(false));
    }

    @Test
    void ignore_a_returned_group_that_was_not_asked_about() {
        GroupMembershipResolver overReporting = (username, groups) -> Set.of("operators");

        assertThat(overReporting.isMember("alice", "architects"), is(false));
    }

    @Test
    void propagate_an_exception_from_member_groups() {
        GroupMembershipResolver failing = (username, groups) -> {
            throw new IllegalStateException("directory unavailable");
        };

        assertThrows(IllegalStateException.class, () -> failing.isMember("alice", "architects"));
    }

    @Test
    void ask_member_groups_about_exactly_the_one_group() {
        GroupMembershipResolver checking = (username, groups) -> {
            assertThat(groups, is(List.of("architects")));
            return Set.of();
        };

        assertThat(checking.isMember("alice", "architects"), is(false));
    }
}
