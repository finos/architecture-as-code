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
    }

    private void givenAuthenticatedUser(String username) throws UserAccessNotFoundException {
        when(mockIdentity.isAnonymous()).thenReturn(false);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn(username);
    }

    @Test
    void read_grant_allows_read_check() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.read, "foo", UserAccess.ResourceType.architectures);
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.allowArchitectureRead(mockIdentity, "foo"));
    }

    @Test
    void write_grant_allows_read_check() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.write, "foo", UserAccess.ResourceType.architectures);
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.allowArchitectureRead(mockIdentity, "foo"));
    }

    @Test
    void read_grant_denies_write_check() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.read, "foo", UserAccess.ResourceType.architectures);
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.allowArchitectureWrite(mockIdentity, "foo"));
    }

    @Test
    void grant_for_different_namespace_denies_check() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.write, "bar", UserAccess.ResourceType.architectures);
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.allowArchitectureWrite(mockIdentity, "foo"));
    }

    @Test
    void all_resource_type_satisfies_any_specific_resource_check() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.write, "foo", UserAccess.ResourceType.all);
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertTrue(checker.allowArchitectureRead(mockIdentity, "foo"));
        assertTrue(checker.allowPatternRead(mockIdentity, "foo"));
        assertTrue(checker.allowFlowRead(mockIdentity, "foo"));
        assertTrue(checker.allowAdrRead(mockIdentity, "foo"));
    }

    @Test
    void user_with_no_grants_is_denied() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        assertFalse(checker.allowArchitectureRead(mockIdentity, "foo"));
    }

    @Test
    void pattern_grant_does_not_satisfy_architecture_check() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess grant = new UserAccess("alice", UserAccess.Permission.write, "foo", UserAccess.ResourceType.patterns);
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(grant));

        assertFalse(checker.allowArchitectureRead(mockIdentity, "foo"));
        assertTrue(checker.allowPatternRead(mockIdentity, "foo"));
    }

    @Test
    void anonymous_identity_is_always_allowed() {
        when(mockIdentity.isAnonymous()).thenReturn(true);

        assertTrue(checker.allowArchitectureRead(mockIdentity, "foo"));
        assertTrue(checker.allowArchitectureWrite(mockIdentity, "foo"));
        assertTrue(checker.allowPatternRead(mockIdentity, "foo"));
        assertTrue(checker.allowFlowWrite(mockIdentity, "foo"));
        assertTrue(checker.allowAdrRead(mockIdentity, "foo"));
        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    @Test
    void namespace_admin_check_requires_admin_permission() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess writeGrant = new UserAccess("alice", UserAccess.Permission.write, "foo", UserAccess.ResourceType.all);
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(writeGrant));

        assertFalse(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    @Test
    void namespace_admin_check_passes_with_admin_permission() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess adminGrant = new UserAccess("alice", UserAccess.Permission.admin, "foo", UserAccess.ResourceType.architectures);
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(adminGrant));

        assertTrue(checker.allowNamespaceAdmin(mockIdentity, "foo"));
    }

    @Test
    void admin_permission_allows_write_check() throws UserAccessNotFoundException {
        givenAuthenticatedUser("alice");
        UserAccess adminGrant = new UserAccess("alice", UserAccess.Permission.admin, "foo", UserAccess.ResourceType.architectures);
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(adminGrant));

        assertTrue(checker.allowArchitectureWrite(mockIdentity, "foo"));
        assertTrue(checker.allowArchitectureRead(mockIdentity, "foo"));
    }
}
