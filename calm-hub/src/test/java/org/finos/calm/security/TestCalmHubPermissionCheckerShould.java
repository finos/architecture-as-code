package org.finos.calm.security;

import io.quarkus.security.identity.SecurityIdentity;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestCalmHubPermissionCheckerShould {

    @Mock
    UserAccessStore mockUserAccessStore;

    @Mock
    SecurityIdentity mockIdentity;

    @Mock
    Principal mockPrincipal;

    CalmHubPermissionChecker checker;

    @BeforeEach
    void setUp() {
        checker = new CalmHubPermissionChecker(mockUserAccessStore);
        checker.authEnabled = true;
    }

    private void givenAuthenticatedUser(String username) {
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn(username);
    }

    private UserAccess grant(String username, UserAccess.Permission permission, String namespace) {
        return new UserAccess(username, permission, namespace);
    }

    // --- ancestorChain utility ---

    @Test
    void ancestor_chain_for_single_segment_namespace() {
        assertEquals(List.of("org"), CalmHubPermissionChecker.ancestorChain("org"));
    }

    @Test
    void ancestor_chain_for_multi_segment_namespace() {
        assertEquals(List.of("org", "org.ab", "org.ab.cd"),
                CalmHubPermissionChecker.ancestorChain("org.ab.cd"));
    }

    // --- Flat namespace READ (single-level, backward-compatible) ---

    @Test
    void read_grant_on_exact_namespace_allows_read() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.read, "foo")));

        assertTrue(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void write_grant_on_exact_namespace_allows_read() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.write, "foo")));

        assertTrue(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void admin_grant_on_exact_namespace_allows_read_and_write() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.admin, "foo")));

        assertTrue(checker.canRead(mockIdentity, "foo"));
        assertTrue(checker.canWrite(mockIdentity, "foo"));
    }

    @Test
    void grant_for_different_namespace_denies_read() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.write, "bar")));

        assertFalse(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void empty_grants_denies_read() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());

        assertFalse(checker.canRead(mockIdentity, "foo"));
    }

    // --- Hierarchical READ (AND across ancestor chain) ---

    @Test
    void read_requires_grant_at_every_ancestor_level() {
        givenAuthenticatedUser("bob");
        // Grant at parent and target, but NOT at middle level → denied
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of(
                grant("bob", UserAccess.Permission.read, "org"),
                grant("bob", UserAccess.Permission.read, "org.ab.cd")
        ));

        assertFalse(checker.canRead(mockIdentity, "org.ab.cd"));
    }

    @Test
    void read_granted_when_all_ancestor_levels_have_grants() {
        givenAuthenticatedUser("bob");
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of(
                grant("bob", UserAccess.Permission.read, "org"),
                grant("bob", UserAccess.Permission.read, "org.ab"),
                grant("bob", UserAccess.Permission.read, "org.ab.cd")
        ));

        assertTrue(checker.canRead(mockIdentity, "org.ab.cd"));
    }

    @Test
    void wildcard_grants_satisfy_read_at_each_level() {
        givenAuthenticatedUser("carol");
        when(mockUserAccessStore.getGrantsForUser("carol")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("*", UserAccess.Permission.read, "org.ab"),
                grant("carol", UserAccess.Permission.read, "org.ab.cd")
        ));

        assertTrue(checker.canRead(mockIdentity, "org.ab.cd"));
    }

    @Test
    void missing_wildcard_at_one_level_denies_read_even_with_explicit_grant_at_target() {
        givenAuthenticatedUser("dave");
        // public at org and org.ab.cd but NOT at org.ab → dave can't read org.ab.cd
        when(mockUserAccessStore.getGrantsForUser("dave")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("dave", UserAccess.Permission.read, "org.ab.cd")
        ));

        assertFalse(checker.canRead(mockIdentity, "org.ab.cd"));
    }

    @Test
    void wildcard_read_at_all_ancestors_allows_anyone_to_read() {
        givenAuthenticatedUser("anonymous");
        when(mockUserAccessStore.getGrantsForUser("anonymous")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("*", UserAccess.Permission.read, "org.ab")
        ));

        assertTrue(checker.canRead(mockIdentity, "org.ab"));
    }

    // --- Hierarchical WRITE (OR across ancestor chain) ---

    @Test
    void read_grant_denies_write() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.read, "foo")));

        assertFalse(checker.canWrite(mockIdentity, "foo"));
    }

    @Test
    void write_grant_allows_write() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.write, "foo")));

        assertTrue(checker.canWrite(mockIdentity, "foo"));
    }

    @Test
    void write_grant_on_parent_namespace_allows_write_on_child() {
        givenAuthenticatedUser("mark");
        // mark has write on "org.ab" → can write "org.ab.cd" (OR rule)
        when(mockUserAccessStore.getGrantsForUser("mark")).thenReturn(List.of(
                grant("mark", UserAccess.Permission.write, "org.ab")
        ));

        assertTrue(checker.canWrite(mockIdentity, "org.ab.cd"));
    }

    @Test
    void write_grant_only_on_sibling_denies_write() {
        givenAuthenticatedUser("mark");
        when(mockUserAccessStore.getGrantsForUser("mark")).thenReturn(List.of(
                grant("mark", UserAccess.Permission.write, "org.xy")
        ));

        assertFalse(checker.canWrite(mockIdentity, "org.ab.cd"));
    }

    // --- Hierarchical ADMIN (OR across ancestor chain) ---

    @Test
    void write_grant_denies_namespace_admin() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.write, "foo")));

        assertFalse(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    @Test
    void admin_grant_allows_namespace_admin() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.admin, "foo")));

        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    @Test
    void admin_grant_on_parent_allows_admin_on_child() {
        givenAuthenticatedUser("carol");
        when(mockUserAccessStore.getGrantsForUser("carol")).thenReturn(List.of(
                grant("carol", UserAccess.Permission.admin, "org.ab")
        ));

        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "org.ab.cd"));
    }

    // --- mark/carol/bob worked example from design doc ---

    @Test
    void design_example_mark_can_write_org_ab_cd_but_not_read_or_admin() {
        // * read org, * read org.ab, mark write org.ab — no grant at org.ab.cd
        // write OR-rule: mark write at ancestor org.ab → can write org.ab.cd
        // read AND-rule: no grant at org.ab.cd (mark or *) → cannot read org.ab.cd
        givenAuthenticatedUser("mark");
        when(mockUserAccessStore.getGrantsForUser("mark")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("*", UserAccess.Permission.read, "org.ab"),
                grant("mark", UserAccess.Permission.write, "org.ab")
        ));

        assertFalse(checker.canRead(mockIdentity, "org.ab.cd"));
        assertTrue(checker.canWrite(mockIdentity, "org.ab.cd"));
        assertFalse(checker.allowNamespaceAdmin(mockIdentity, "org.ab.cd"));
    }

    @Test
    void design_example_carol_can_read_write_and_admin_org_ab_cd() {
        // * read org, * read org.ab, carol admin org.ab.cd
        givenAuthenticatedUser("carol");
        when(mockUserAccessStore.getGrantsForUser("carol")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("*", UserAccess.Permission.read, "org.ab"),
                grant("carol", UserAccess.Permission.admin, "org.ab.cd")
        ));

        assertTrue(checker.canRead(mockIdentity, "org.ab.cd"));
        assertTrue(checker.canWrite(mockIdentity, "org.ab.cd"));
        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "org.ab.cd"));
    }

    @Test
    void design_example_bob_can_only_read_org_ab_cd() {
        // * read org, * read org.ab, bob read org.ab.cd
        givenAuthenticatedUser("bob");
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("*", UserAccess.Permission.read, "org.ab"),
                grant("bob", UserAccess.Permission.read, "org.ab.cd")
        ));

        assertTrue(checker.canRead(mockIdentity, "org.ab.cd"));
        assertFalse(checker.canWrite(mockIdentity, "org.ab.cd"));
        assertFalse(checker.allowNamespaceAdmin(mockIdentity, "org.ab.cd"));
    }

    @Test
    void design_example_anonymous_cannot_read_org_ab_cd_when_no_wildcard_at_that_level() {
        // * read org, * read org.ab — but NO grant at org.ab.cd
        givenAuthenticatedUser("anonymous");
        when(mockUserAccessStore.getGrantsForUser("anonymous")).thenReturn(List.of(
                grant("*", UserAccess.Permission.read, "org"),
                grant("*", UserAccess.Permission.read, "org.ab")
        ));

        assertFalse(checker.canRead(mockIdentity, "org.ab.cd"));
    }

    // --- allow-public-read global flag ---

    @Test
    void public_read_enabled_allows_any_user_to_read_without_store_lookup() {
        checker.allowPublicRead = true;

        assertTrue(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void public_read_enabled_does_not_grant_write_access() {
        checker.allowPublicRead = true;
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());

        assertFalse(checker.canWrite(mockIdentity, "foo"));
    }

    @Test
    void public_read_enabled_does_not_grant_namespace_admin_access() {
        checker.allowPublicRead = true;
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());

        assertFalse(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    // --- Domain READ checks ---

    @Test
    void read_grant_for_domain_allows_domain_read() {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.read).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void write_grant_for_domain_allows_domain_read() {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.write).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void grant_for_different_domain_denies_domain_read() {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.read).setDomain("orders").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(grant));

        assertFalse(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void namespace_grant_does_not_satisfy_domain_read() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.read, "payments")));

        assertFalse(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void user_with_no_grants_is_denied_domain_read() {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());

        assertFalse(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void wildcard_read_grant_for_domain_allows_domain_read() {
        givenAuthenticatedUser("alice");
        UserAccess wildcardGrant = new UserAccess.UserAccessBuilder()
                .setUsername("*").setPermission(UserAccess.Permission.read).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(wildcardGrant));

        assertTrue(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void global_admin_is_allowed_domain_read_without_domain_grant() {
        givenAuthenticatedUser("alice");
        UserAccess globalGrant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(globalGrant));

        assertTrue(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void public_read_enabled_allows_domain_read_without_store_lookup() {
        checker.allowPublicRead = true;

        assertTrue(checker.canReadByDomain(mockIdentity, "payments"));
    }

    // --- Domain WRITE checks ---

    @Test
    void read_grant_for_domain_denies_domain_write() {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.read).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(grant));

        assertFalse(checker.canWriteByDomain(mockIdentity, "payments"));
    }

    @Test
    void write_grant_for_domain_allows_domain_write() {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.write).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canWriteByDomain(mockIdentity, "payments"));
    }

    @Test
    void wildcard_write_grant_for_domain_allows_domain_write() {
        givenAuthenticatedUser("alice");
        UserAccess wildcardGrant = new UserAccess.UserAccessBuilder()
                .setUsername("*").setPermission(UserAccess.Permission.write).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(wildcardGrant));

        assertTrue(checker.canWriteByDomain(mockIdentity, "payments"));
    }

    @Test
    void global_admin_is_allowed_domain_write_without_domain_grant() {
        givenAuthenticatedUser("alice");
        UserAccess globalGrant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(globalGrant));

        assertTrue(checker.canWriteByDomain(mockIdentity, "payments"));
    }

    // --- Domain ADMIN checks ---

    @Test
    void admin_grant_for_domain_allows_domain_admin() {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(grant));

        assertTrue(checker.allowDomainAdmin(mockIdentity, "payments"));
    }

    @Test
    void write_grant_for_domain_denies_domain_admin() {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.write).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(grant));

        assertFalse(checker.allowDomainAdmin(mockIdentity, "payments"));
    }

    @Test
    void global_admin_is_allowed_domain_admin_without_domain_grant() {
        givenAuthenticatedUser("alice");
        UserAccess globalGrant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(globalGrant));

        assertTrue(checker.allowDomainAdmin(mockIdentity, "payments"));
    }

    @Test
    void wildcard_admin_grant_for_domain_allows_domain_admin() {
        givenAuthenticatedUser("alice");
        UserAccess wildcardGrant = new UserAccess.UserAccessBuilder()
                .setUsername("*").setPermission(UserAccess.Permission.admin).setDomain("payments").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(wildcardGrant));

        assertTrue(checker.allowDomainAdmin(mockIdentity, "payments"));
    }

    @Test
    void public_read_enabled_does_not_grant_domain_write() {
        checker.allowPublicRead = true;
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());

        assertFalse(checker.canWriteByDomain(mockIdentity, "payments"));
    }

    @Test
    void public_read_enabled_does_not_grant_domain_admin() {
        checker.allowPublicRead = true;
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(Collections.emptyList());

        assertFalse(checker.allowDomainAdmin(mockIdentity, "payments"));
    }

    @Test
    void public_read_enabled_does_not_grant_global_admin() throws UserAccessNotFoundException {
        checker.allowPublicRead = true;
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        assertFalse(checker.hasGlobalAdmin(mockIdentity));
    }

    @Test
    void no_auth_mode_grants_domain_admin_without_store_lookup() {
        checker.authEnabled = false;

        assertTrue(checker.allowDomainAdmin(mockIdentity, "payments"));
    }

    // --- authEnabled=false (no-auth mode) ---

    @Test
    void no_auth_mode_grants_read_without_store_lookup() {
        checker.authEnabled = false;

        assertTrue(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void no_auth_mode_grants_write_without_store_lookup() {
        checker.authEnabled = false;

        assertTrue(checker.canWrite(mockIdentity, "foo"));
    }

    @Test
    void no_auth_mode_grants_namespace_admin_without_store_lookup() {
        checker.authEnabled = false;

        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    @Test
    void no_auth_mode_grants_global_admin_without_store_lookup() {
        checker.authEnabled = false;

        assertTrue(checker.hasGlobalAdmin(mockIdentity));
    }

    @Test
    void no_auth_mode_grants_domain_read_and_write_without_store_lookup() {
        checker.authEnabled = false;

        assertTrue(checker.canReadByDomain(mockIdentity, "payments"));
        assertTrue(checker.canWriteByDomain(mockIdentity, "payments"));
    }

    // --- Global admin implies namespace admin ---

    @Test
    void global_admin_is_allowed_namespace_read_without_namespace_grant() {
        givenAuthenticatedUser("alice");
        UserAccess globalGrant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(globalGrant));

        assertTrue(checker.canRead(mockIdentity, "finos"));
        assertTrue(checker.canRead(mockIdentity, "org.payments.fx"));
    }

    @Test
    void global_admin_is_allowed_namespace_write_without_namespace_grant() {
        givenAuthenticatedUser("alice");
        UserAccess globalGrant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(globalGrant));

        assertTrue(checker.canWrite(mockIdentity, "finos"));
        assertTrue(checker.canWrite(mockIdentity, "org.payments.fx"));
    }

    @Test
    void global_admin_is_allowed_namespace_admin_on_any_namespace() {
        givenAuthenticatedUser("alice");
        UserAccess globalGrant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(globalGrant));

        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "finos"));
        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "org.payments.fx"));
    }

    @Test
    void global_admin_can_manage_namespace_access_when_no_namespace_grants_exist() {
        // Bootstrapping: global admin creates a namespace; no namespace-specific grants exist yet.
        // Global admin must be able to grant the first namespace admin without needing a pre-existing grant.
        givenAuthenticatedUser("alice");
        UserAccess globalGrant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(globalGrant));

        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "brand-new-namespace"));
    }

    @Test
    void wildcard_global_admin_grant_does_not_grant_namespace_admin() {
        // A * grant on GLOBAL must not elevate all users to global admin.
        givenAuthenticatedUser("alice");
        UserAccess wildcardGlobal = new UserAccess.UserAccessBuilder()
                .setUsername("*").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(wildcardGlobal));

        assertFalse(checker.allowNamespaceAdmin(mockIdentity, "finos"));
    }

    // --- GLOBAL ADMIN checks (unchanged) ---

    @Test
    void global_admin_grant_on_global_namespace_grants_global_admin() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess globalGrant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(globalGrant));

        assertTrue(checker.hasGlobalAdmin(mockIdentity));
    }

    @Test
    void write_grant_on_global_namespace_denies_global_admin() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.write).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.hasGlobalAdmin(mockIdentity));
    }

    @Test
    void admin_grant_on_non_global_namespace_denies_global_admin() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice"))
                .thenReturn(List.of(grant("alice", UserAccess.Permission.admin, "finos")));

        assertFalse(checker.hasGlobalAdmin(mockIdentity));
    }

    @Test
    void user_with_no_grants_is_denied_global_admin() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        assertFalse(checker.hasGlobalAdmin(mockIdentity));
    }
}
