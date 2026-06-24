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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestUserAccessValidatorShould {

    @Mock
    UserAccessStore mockUserAccessStore;

    UserAccessValidator validator;

    @BeforeEach
    void setUp() {
        validator = new UserAccessValidator(mockUserAccessStore);
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
}
