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
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
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

    private void givenAuthenticatedUser(String username) throws UserAccessNotFoundException {
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn(username);
    }

    // --- READ checks ---

    @Test
    void read_grant_allows_read() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.read, "foo");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void write_grant_allows_read() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.write, "foo");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void grant_for_different_namespace_denies_read() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.write, "bar");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void user_with_no_grants_is_denied_read() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        assertFalse(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void any_namespace_grant_satisfies_read_regardless_of_resource_type() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.read, "foo");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canRead(mockIdentity, "foo"));
    }

    // --- WRITE checks ---

    @Test
    void read_grant_denies_write() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.read, "foo");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.canWrite(mockIdentity, "foo"));
    }

    @Test
    void write_grant_allows_write() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.write, "foo");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canWrite(mockIdentity, "foo"));
    }

    @Test
    void admin_grant_allows_read_and_write() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.admin, "foo");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canRead(mockIdentity, "foo"));
        assertTrue(checker.canWrite(mockIdentity, "foo"));
    }

    // --- ADMIN checks ---

    @Test
    void write_grant_denies_namespace_admin() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.write, "foo");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    @Test
    void admin_grant_allows_namespace_admin() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.admin, "foo");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    // --- allowPublicRead ---

    @Test
    void public_read_disabled_denies_user_without_grants() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        assertFalse(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void public_read_enabled_allows_any_authenticated_user_to_read() {
        checker.allowPublicRead = true;

        assertTrue(checker.canRead(mockIdentity, "foo"));
    }

    @Test
    void public_read_enabled_does_not_grant_write_access() throws UserAccessNotFoundException {
        checker.allowPublicRead = true;
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        assertFalse(checker.canWrite(mockIdentity, "foo"));
    }

    @Test
    void public_read_enabled_does_not_grant_namespace_admin_access() throws UserAccessNotFoundException {
        checker.allowPublicRead = true;
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        assertFalse(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    @Test
    void public_read_enabled_allows_read_without_store_lookup() {
        checker.allowPublicRead = true;
        // No isAnonymous() stub and no store stub — confirms both are bypassed when allowPublicRead is true

        assertTrue(checker.canRead(mockIdentity, "foo"));
    }

    // --- Domain READ checks ---

    @Test
    void read_grant_for_domain_allows_domain_read() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.read).setDomain("payments").build();
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void write_grant_for_domain_allows_domain_read() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.write).setDomain("payments").build();
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void grant_for_different_domain_denies_domain_read() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.read).setDomain("orders").build();
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void namespace_grant_does_not_satisfy_domain_read() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.read, "payments");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void user_with_no_grants_is_denied_domain_read() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        assertFalse(checker.canReadByDomain(mockIdentity, "payments"));
    }

    @Test
    void public_read_enabled_allows_domain_read_without_store_lookup() {
        checker.allowPublicRead = true;

        assertTrue(checker.canReadByDomain(mockIdentity, "payments"));
    }

    // --- Domain WRITE checks ---

    @Test
    void read_grant_for_domain_denies_domain_write() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.read).setDomain("payments").build();
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.canWriteByDomain(mockIdentity, "payments"));
    }

    @Test
    void write_grant_for_domain_allows_domain_write() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.write).setDomain("payments").build();
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.canWriteByDomain(mockIdentity, "payments"));
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

    // --- GLOBAL ADMIN checks ---

    @Test
    void global_admin_grant_on_global_namespace_grants_global_admin() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess.UserAccessBuilder()
                .setUsername("alice").setPermission(UserAccess.Permission.admin).setNamespace("GLOBAL").build();
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

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
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.admin, "finos");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.hasGlobalAdmin(mockIdentity));
    }

    @Test
    void user_with_no_grants_is_denied_global_admin() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        assertFalse(checker.hasGlobalAdmin(mockIdentity));
    }
}
