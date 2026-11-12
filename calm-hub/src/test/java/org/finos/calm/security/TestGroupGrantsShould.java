package org.finos.calm.security;

import org.finos.calm.domain.UserAccess;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGroupGrantsShould {

    @Mock
    GroupMembershipResolver mockGroupMembershipResolver;

    private UserAccess groupGrant(String group, String namespace) {
        return new UserAccess.UserAccessBuilder()
                .setUsername(group)
                .setSubjectType(UserAccess.SubjectType.group)
                .setPermission(UserAccess.Permission.read)
                .setNamespace(namespace)
                .build();
    }

    @Test
    void keep_the_grants_of_member_groups_from_one_resolver_call_with_the_distinct_groups() {
        UserAccess architectsOrg = groupGrant("architects", "org");
        UserAccess architectsOrgAb = groupGrant("architects", "org.ab");
        UserAccess reviewers = groupGrant("reviewers", "org");
        when(mockGroupMembershipResolver.memberGroups("alice", Set.of("architects", "reviewers")))
                .thenReturn(Set.of("architects"));

        List<UserAccess> result = new GroupGrants(mockGroupMembershipResolver)
                .forMembers("alice", List.of(architectsOrg, reviewers, architectsOrgAb));

        assertThat(result, contains(architectsOrg, architectsOrgAb));
        verify(mockGroupMembershipResolver, times(1)).memberGroups(anyString(), anyCollection());
        verify(mockGroupMembershipResolver).memberGroups("alice", Set.of("architects", "reviewers"));
    }

    @Test
    void not_call_the_resolver_for_no_grants() {
        assertThat(new GroupGrants(mockGroupMembershipResolver).forMembers("alice", List.of()), empty());
        verifyNoInteractions(mockGroupMembershipResolver);
    }

    @Test
    void keep_nothing_when_the_resolver_throws() {
        when(mockGroupMembershipResolver.memberGroups(anyString(), anyCollection()))
                .thenThrow(new IllegalStateException("directory unavailable"));

        assertThat(new GroupGrants(mockGroupMembershipResolver)
                .forMembers("alice", List.of(groupGrant("architects", "org"))), empty());
    }

    @Test
    void keep_nothing_when_the_resolver_returns_null() {
        when(mockGroupMembershipResolver.memberGroups(anyString(), anyCollection())).thenReturn(null);

        assertThat(new GroupGrants(mockGroupMembershipResolver)
                .forMembers("alice", List.of(groupGrant("architects", "org"))), empty());
    }

    @Test
    void ignore_a_returned_group_that_has_no_grant() {
        when(mockGroupMembershipResolver.memberGroups("alice", Set.of("architects"))).thenReturn(Set.of("operators"));

        assertThat(new GroupGrants(mockGroupMembershipResolver)
                .forMembers("alice", List.of(groupGrant("architects", "org"))), empty());
    }
}
