package org.finos.calm.security.ldap;

import org.finos.calm.config.LdapGroupsConfigStub;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestLdapGroupMembershipResolverShould {

    private static final String ALICE_DN = "uid=alice,ou=people,dc=example,dc=com";

    @Mock
    DirectoryClient mockDirectoryClient;

    @Mock
    DirectorySession mockSession;

    private LdapGroupsConfigStub config;

    @BeforeEach
    void setUp() {
        config = new LdapGroupsConfigStub();
    }

    private LdapGroupMembershipResolver resolver() {
        return new LdapGroupMembershipResolver(mockDirectoryClient, config);
    }

    private void givenDirectory() throws DirectoryException {
        when(mockDirectoryClient.open()).thenReturn(mockSession);
    }

    @Test
    void return_the_member_groups_from_the_directory() throws Exception {
        givenDirectory();
        when(mockSession.findUserDn("alice")).thenReturn(Optional.of(ALICE_DN));
        when(mockSession.findMemberGroups(ALICE_DN, Set.of("architects", "reviewers"))).thenReturn(Set.of("architects"));

        assertThat(resolver().memberGroups("alice", List.of("architects", "reviewers")), containsInAnyOrder("architects"));
        verify(mockSession).close();
    }

    @Test
    void answer_from_the_cache_without_opening_a_session() throws Exception {
        givenDirectory();
        when(mockSession.findUserDn("alice")).thenReturn(Optional.of(ALICE_DN));
        when(mockSession.findMemberGroups(ALICE_DN, Set.of("architects", "reviewers"))).thenReturn(Set.of("architects"));
        LdapGroupMembershipResolver resolver = resolver();

        resolver.memberGroups("alice", List.of("architects", "reviewers"));
        Set<String> second = resolver.memberGroups("alice", List.of("architects", "reviewers"));

        assertThat(second, containsInAnyOrder("architects"));
        verify(mockDirectoryClient, times(1)).open();
    }

    @Test
    void ask_the_directory_only_about_uncached_groups_and_reuse_the_user_dn() throws Exception {
        givenDirectory();
        when(mockSession.findUserDn("alice")).thenReturn(Optional.of(ALICE_DN));
        when(mockSession.findMemberGroups(ALICE_DN, Set.of("architects"))).thenReturn(Set.of("architects"));
        when(mockSession.findMemberGroups(ALICE_DN, Set.of("operators"))).thenReturn(Set.of());
        LdapGroupMembershipResolver resolver = resolver();

        resolver.memberGroups("alice", List.of("architects"));
        Set<String> result = resolver.memberGroups("alice", List.of("architects", "operators"));

        assertThat(result, containsInAnyOrder("architects"));
        verify(mockSession, times(1)).findUserDn("alice");
        verify(mockSession).findMemberGroups(ALICE_DN, Set.of("operators"));
    }

    @Test
    void return_no_groups_and_cache_an_unknown_user() throws Exception {
        givenDirectory();
        when(mockSession.findUserDn("ghost")).thenReturn(Optional.empty());
        LdapGroupMembershipResolver resolver = resolver();

        assertThat(resolver.memberGroups("ghost", List.of("architects")), is(empty()));
        assertThat(resolver.memberGroups("ghost", List.of("architects")), is(empty()));

        verify(mockDirectoryClient, times(1)).open();
        verify(mockSession, never()).findMemberGroups(anyString(), anyCollection());
    }

    @Test
    void not_open_a_session_for_no_groups() throws Exception {
        assertThat(resolver().memberGroups("alice", List.of()), is(empty()));
        verify(mockDirectoryClient, never()).open();
    }

    @Test
    void return_no_groups_and_cache_nothing_when_the_directory_fails() throws Exception {
        givenDirectory();
        when(mockSession.findUserDn("alice"))
                .thenThrow(new DirectoryException("timeout"))
                .thenReturn(Optional.of(ALICE_DN));
        when(mockSession.findMemberGroups(ALICE_DN, Set.of("architects"))).thenReturn(Set.of("architects"));
        LdapGroupMembershipResolver resolver = resolver();

        assertThat(resolver.memberGroups("alice", List.of("architects")), is(empty()));
        verify(mockSession).close();

        assertThat(resolver.memberGroups("alice", List.of("architects")), containsInAnyOrder("architects"));
    }

    @Test
    void keep_cached_members_and_deny_uncached_groups_when_the_directory_fails() throws Exception {
        givenDirectory();
        when(mockSession.findUserDn("alice")).thenReturn(Optional.of(ALICE_DN));
        when(mockSession.findMemberGroups(ALICE_DN, Set.of("architects", "operators")))
                .thenReturn(Set.of("architects"));
        when(mockSession.findMemberGroups(ALICE_DN, Set.of("reviewers")))
                .thenThrow(new DirectoryException("connection reset"));
        LdapGroupMembershipResolver resolver = resolver();
        resolver.memberGroups("alice", List.of("architects", "operators"));

        Set<String> during = resolver.memberGroups("alice", List.of("architects", "operators", "reviewers"));

        assertThat(during, containsInAnyOrder("architects"));
        verify(mockSession, times(2)).findMemberGroups(anyString(), anyCollection());
    }

    @Test
    void keep_cached_members_when_a_session_cannot_be_opened() throws Exception {
        when(mockDirectoryClient.open())
                .thenReturn(mockSession)
                .thenThrow(new DirectoryException("connection refused"));
        when(mockSession.findUserDn("alice")).thenReturn(Optional.of(ALICE_DN));
        when(mockSession.findMemberGroups(ALICE_DN, Set.of("architects"))).thenReturn(Set.of("architects"));
        LdapGroupMembershipResolver resolver = resolver();
        resolver.memberGroups("alice", List.of("architects"));

        assertThat(resolver.memberGroups("alice", List.of("architects", "reviewers")), containsInAnyOrder("architects"));
    }

    @Test
    void not_cache_with_zero_ttls() throws Exception {
        config.cache.positiveTtl = Duration.ZERO;
        config.cache.negativeTtl = Duration.ZERO;
        config.cache.dnTtl = Duration.ZERO;
        givenDirectory();
        when(mockSession.findUserDn("alice")).thenReturn(Optional.of(ALICE_DN));
        when(mockSession.findMemberGroups(any(), anyCollection())).thenReturn(Set.of("architects"));
        LdapGroupMembershipResolver resolver = resolver();

        resolver.memberGroups("alice", List.of("architects"));
        resolver.memberGroups("alice", List.of("architects"));

        verify(mockDirectoryClient, times(2)).open();
        verify(mockSession, times(2)).findUserDn("alice");
    }

    @Test
    void cache_a_non_member_answer() throws Exception {
        givenDirectory();
        when(mockSession.findUserDn("alice")).thenReturn(Optional.of(ALICE_DN));
        when(mockSession.findMemberGroups(ALICE_DN, Set.of("operators"))).thenReturn(Set.of());
        LdapGroupMembershipResolver resolver = resolver();

        assertThat(resolver.memberGroups("alice", List.of("operators")), is(empty()));
        assertThat(resolver.memberGroups("alice", List.of("operators")), is(empty()));

        verify(mockDirectoryClient, times(1)).open();
    }
}
