package org.finos.calm.security;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;

@QuarkusTest
public class TestNoGroupMembershipResolverShould {

    @Inject
    GroupMembershipResolver resolver;

    @Test
    void be_the_resolver_when_no_provider_is_configured() {
        assertThat(resolver.memberGroups("alice", List.of("architects")), is(empty()));
    }

    @Test
    void report_that_no_user_is_a_member_of_any_group() {
        NoGroupMembershipResolver noGroups = new NoGroupMembershipResolver();

        assertThat(noGroups.isMember("alice", "architects"), is(false));
        assertThat(noGroups.memberGroups("alice", List.of("architects", "alice")), is(empty()));
    }
}
