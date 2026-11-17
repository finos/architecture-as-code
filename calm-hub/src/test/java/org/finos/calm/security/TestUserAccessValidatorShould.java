package org.finos.calm.security;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestUserAccessValidatorShould {

    @Mock
    UserAccessStore mockUserAccessStore;

    @Mock
    GroupMembershipResolver mockGroupMembershipResolver;

    UserAccessValidator validator;

    @BeforeEach
    void setUp() {
        validator = new UserAccessValidator(mockUserAccessStore, new GroupGrants(mockGroupMembershipResolver));
        validator.allowPublicRead = false;
    }

    private UserAccess grant(String username, UserAccess.Permission permission, String namespace) {
        return new UserAccess(username, permission, namespace);
    }

    // --- Bypass cases: Optional.empty() means "all namespaces" ---

    @Test
    void return_empty_optional_when_allow_public_read_is_true() {
        validator.allowPublicRead = true;

        assertEquals(Optional.empty(), validator.getReadableNamespaces("alice"));
    }

    @Test
    void return_empty_optional_for_global_admin_user() {
        when(mockUserAccessStore.getGrantsForUser("admin")).thenReturn(List.of(
                grant("admin", UserAccess.Permission.admin, CalmHubPermissionChecker.GLOBAL_ACCESS)
        ));

        assertEquals(Optional.empty(), validator.getReadableNamespaces("admin"));
    }

    // --- No grants: Optional.of(empty set) is distinct from the bypass Optional.empty() ---

    @Test
    void return_present_empty_set_when_user_has_no_grants() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());

        Optional<Set<String>> result = validator.getReadableNamespaces("alice");
        assertTrue(result.isPresent());
        assertTrue(result.get().isEmpty());
    }

    // --- Flat single-level namespaces (backward-compatible) ---

    @Test
    void return_flat_namespace_when_user_has_direct_read_grant() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(
                grant("alice", UserAccess.Permission.read, "finos")
        ));

        assertEquals(Optional.of(Set.of("finos")), validator.getReadableNamespaces("alice"));
    }

    @Test
    void return_flat_namespace_when_user_has_write_grant() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(
                grant("alice", UserAccess.Permission.write, "workshop")
        ));

        assertEquals(Optional.of(Set.of("workshop")), validator.getReadableNamespaces("alice"));
    }

    @Test
    void return_multiple_flat_namespaces() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(
                grant("alice", UserAccess.Permission.read, "finos"),
                grant("alice", UserAccess.Permission.write, "workshop")
        ));

        assertEquals(Optional.of(Set.of("finos", "workshop")), validator.getReadableNamespaces("alice"));
    }

    // --- Wildcard grants included ---

    @Test
    void return_namespace_covered_by_wildcard_grant() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org")
        ));

        assertEquals(Optional.of(Set.of("org")), validator.getReadableNamespaces("alice"));
    }

    // --- Hierarchical AND rule ---

    @Test
    void return_child_namespace_when_all_ancestor_levels_are_covered() {
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("*", UserAccess.Permission.read, "org.ab"),
                grant("bob", UserAccess.Permission.read, "org.ab.cd")
        ));

        assertEquals(Optional.of(Set.of("org", "org.ab", "org.ab.cd")),
                validator.getReadableNamespaces("bob"));
    }

    @Test
    void exclude_child_namespace_when_intermediate_level_has_no_grant() {
        // org.ab has no grant — org.ab.cd cannot pass the AND check
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("bob", UserAccess.Permission.read, "org.ab.cd")
        ));

        // Only "org" is fully readable; "org.ab.cd" fails AND at "org.ab"
        assertEquals(Optional.of(Set.of("org")), validator.getReadableNamespaces("bob"));
    }

    @Test
    void exclude_child_when_parent_grant_exists_but_not_intermediate() {
        when(mockUserAccessStore.getGrantsForUser("carol")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("carol", UserAccess.Permission.admin, "org.ab.cd")
        ));

        // "org.ab.cd" fails AND at "org.ab" (no grant there)
        assertEquals(Optional.of(Set.of("org")), validator.getReadableNamespaces("carol"));
    }

    @Test
    void exclude_domain_grants_from_namespace_results() {
        UserAccess domainGrant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.read).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(
                grant("alice", UserAccess.Permission.read, "org"),
                domainGrant
        ));

        // Domain grant should not appear — it has a null namespace
        assertEquals(Optional.of(Set.of("org")), validator.getReadableNamespaces("alice"));
    }

    // --- mark/carol/bob worked example ---

    @Test
    void design_example_returns_correct_readable_set_for_bob() {
        // * read org, * read org.ab, bob read org.ab.cd
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("*", UserAccess.Permission.read, "org.ab"),
                grant("bob", UserAccess.Permission.read, "org.ab.cd")
        ));

        assertEquals(Optional.of(Set.of("org", "org.ab", "org.ab.cd")),
                validator.getReadableNamespaces("bob"));
    }

    @Test
    void design_example_mark_can_only_read_up_to_org_ab_not_org_ab_cd() {
        // * read org, * read org.ab, mark write org.ab — no grant at org.ab.cd
        when(mockUserAccessStore.getGrantsForUser("mark")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("*", UserAccess.Permission.read, "org.ab"),
                grant("mark", UserAccess.Permission.write, "org.ab")
        ));

        // org.ab.cd has no grant in the combined list → excluded
        assertEquals(Optional.of(Set.of("org", "org.ab")), validator.getReadableNamespaces("mark"));
    }

    // --- getReadableDomains: bypass cases (Optional.empty() means "all domains") ---

    @Test
    void return_empty_optional_for_domains_when_allow_public_read_is_true() {
        validator.allowPublicRead = true;

        assertEquals(Optional.empty(), validator.getReadableDomains("alice"));
    }

    @Test
    void return_empty_optional_for_domains_for_global_admin_user() {
        when(mockUserAccessStore.getGrantsForUser("admin")).thenReturn(List.of(
                grant("admin", UserAccess.Permission.admin, CalmHubPermissionChecker.GLOBAL_ACCESS)
        ));

        assertEquals(Optional.empty(), validator.getReadableDomains("admin"));
    }

    // --- getReadableDomains: no grants → present empty set, distinct from bypass ---

    @Test
    void return_present_empty_set_for_domains_when_user_has_no_grants() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());

        Optional<Set<String>> result = validator.getReadableDomains("alice");
        assertTrue(result.isPresent());
        assertTrue(result.get().isEmpty());
    }

    // --- getReadableDomains: subset and source filtering ---

    @Test
    void return_domains_covered_by_read_sufficient_grants() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(
                domainGrant("alice", UserAccess.Permission.read, "security"),
                domainGrant("alice", UserAccess.Permission.write, "payments")
        ));

        assertEquals(Optional.of(Set.of("security", "payments")), validator.getReadableDomains("alice"));
    }

    @Test
    void return_domain_covered_by_wildcard_grant() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(
                domainGrant("*", UserAccess.Permission.read, "security")
        ));

        assertEquals(Optional.of(Set.of("security")), validator.getReadableDomains("alice"));
    }

    @Test
    void exclude_namespace_grants_from_domain_results() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(
                grant("alice", UserAccess.Permission.read, "finos"),
                domainGrant("alice", UserAccess.Permission.read, "security")
        ));

        // The namespace grant has a null domain — only the domain grant appears.
        assertEquals(Optional.of(Set.of("security")), validator.getReadableDomains("alice"));
    }

    private UserAccess domainGrant(String username, UserAccess.Permission permission, String domain) {
        return new UserAccess.UserAccessBuilder()
                .setUsername(username).setPermission(permission).setDomain(domain).build();
    }

    // --- Group grants ---

    private UserAccess groupGrant(String group, UserAccess.Permission permission, String namespace) {
        return new UserAccess.UserAccessBuilder()
                .setUsername(group)
                .setSubjectType(UserAccess.SubjectType.group)
                .setPermission(permission)
                .setNamespace(namespace)
                .build();
    }

    private UserAccess groupDomainGrant(String group, UserAccess.Permission permission, String domain) {
        return new UserAccess.UserAccessBuilder()
                .setUsername(group)
                .setSubjectType(UserAccess.SubjectType.group)
                .setPermission(permission)
                .setDomain(domain)
                .build();
    }

    @Test
    void include_namespaces_readable_through_a_member_group() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.read, "org")));
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of(
                groupGrant("architects", UserAccess.Permission.read, "org.ab"),
                groupGrant("architects", UserAccess.Permission.write, "other"),
                groupGrant("reviewers", UserAccess.Permission.read, "secret")));
        when(mockGroupMembershipResolver.memberGroups("alice", Set.of("architects", "reviewers")))
                .thenReturn(Set.of("architects"));

        assertEquals(Optional.of(Set.of("org", "org.ab", "other")), validator.getReadableNamespaces("alice"));
    }

    @Test
    void apply_the_ancestor_rule_to_group_grants() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of(
                groupGrant("architects", UserAccess.Permission.read, "org.ab")));
        when(mockGroupMembershipResolver.memberGroups("alice", Set.of("architects"))).thenReturn(Set.of("architects"));

        assertEquals(Optional.of(Set.of()), validator.getReadableNamespaces("alice"));
    }

    @Test
    void return_empty_optional_for_a_member_of_a_global_admin_group() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of(
                groupGrant("hub-admins", UserAccess.Permission.admin, CalmHubPermissionChecker.GLOBAL_ACCESS)));
        when(mockGroupMembershipResolver.memberGroups("alice", Set.of("hub-admins"))).thenReturn(Set.of("hub-admins"));

        assertEquals(Optional.empty(), validator.getReadableNamespaces("alice"));
        assertEquals(Optional.empty(), validator.getReadableDomains("alice"));
    }

    @Test
    void exclude_group_grants_when_the_user_is_not_a_member() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of(
                groupGrant("architects", UserAccess.Permission.read, "org")));
        when(mockGroupMembershipResolver.memberGroups("alice", Set.of("architects"))).thenReturn(Set.of());

        assertEquals(Optional.of(Set.of()), validator.getReadableNamespaces("alice"));
    }

    @Test
    void exclude_group_grants_when_the_resolver_throws() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.read, "mine")));
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of(
                groupGrant("architects", UserAccess.Permission.read, "org")));
        when(mockGroupMembershipResolver.memberGroups(anyString(), anyCollection()))
                .thenThrow(new IllegalStateException("directory unavailable"));

        assertEquals(Optional.of(Set.of("mine")), validator.getReadableNamespaces("alice"));
    }

    @Test
    void include_domains_readable_through_a_member_group() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of(
                groupDomainGrant("security-team", UserAccess.Permission.read, "security"),
                groupDomainGrant("payments-team", UserAccess.Permission.read, "payments")));
        when(mockGroupMembershipResolver.memberGroups("alice", Set.of("security-team", "payments-team")))
                .thenReturn(Set.of("security-team"));

        assertEquals(Optional.of(Set.of("security")), validator.getReadableDomains("alice"));
    }

    @Test
    void not_look_up_groups_when_the_user_is_global_admin() {
        when(mockUserAccessStore.getGrantsForUser("admin")).thenReturn(List.of(
                grant("admin", UserAccess.Permission.admin, CalmHubPermissionChecker.GLOBAL_ACCESS)));

        assertEquals(Optional.empty(), validator.getReadableNamespaces("admin"));
        verify(mockUserAccessStore, never()).getAllGroupGrants();
        verifyNoInteractions(mockGroupMembershipResolver);
    }

    @Test
    void not_call_the_resolver_when_there_are_no_group_grants() {
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.read, "org")));
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of());

        assertEquals(Optional.of(Set.of("org")), validator.getReadableNamespaces("alice"));
        verifyNoInteractions(mockGroupMembershipResolver);
    }
}
