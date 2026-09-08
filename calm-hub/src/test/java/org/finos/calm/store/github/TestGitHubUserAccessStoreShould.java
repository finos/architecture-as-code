package org.finos.calm.store.github;

import io.quarkus.security.identity.SecurityIdentity;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.security.OidcRoleResolver;
import org.finos.calm.store.github.util.GitHubCloneManager;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestGitHubUserAccessStoreShould {

    private static final Set<String> ACCESS_GROUPS = Set.of("SCMReadOnly", "SCMDeveloper");

    @Mock
    private InMemoryRegistryService registryService;

    @Mock
    private OidcRoleResolver roleResolver;

    @Mock
    private SecurityIdentity identity;

    @Mock
    private GitHubCloneManager cloneManager;

    private GitHubUserAccessStore store;

    @BeforeEach
    void setup() {
        store = new GitHubUserAccessStore();
        store.registryService = registryService;
        store.roleResolver = roleResolver;
        store.identity = identity;
        store.cloneManager = cloneManager;

        when(cloneManager.getAccessGroupsForNamespace("finos")).thenReturn(ACCESS_GROUPS);
        when(cloneManager.getAccessGroupsForNamespace("team")).thenReturn(ACCESS_GROUPS);
    }

    @Test
    void return_empty_grants_when_no_matching_group() {
        when(roleResolver.resolve(eq(identity), any())).thenReturn(OidcRoleResolver.AccessLevel.NONE);
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "team", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<UserAccess> result = store.getGrantsForUser("testuser");

        assertThat(result, is(empty()));
    }

    @Test
    void return_read_grants_when_group_matches() {
        when(roleResolver.resolve(eq(identity), eq(ACCESS_GROUPS)))
                .thenReturn(OidcRoleResolver.AccessLevel.READ);
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "team", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<UserAccess> result = store.getGrantsForUser("testuser");

        assertThat(result, hasSize(2));
        assertThat(result.get(0).getPermission(), equalTo(UserAccess.Permission.read));
        assertThat(result.get(1).getPermission(), equalTo(UserAccess.Permission.read));
    }

    @Test
    void grant_per_namespace_access_independently() {
        when(cloneManager.getAccessGroupsForNamespace("public")).thenReturn(Set.of("Everyone"));
        when(roleResolver.resolve(eq(identity), eq(Set.of("Everyone"))))
                .thenReturn(OidcRoleResolver.AccessLevel.READ);
        when(roleResolver.resolve(eq(identity), eq(ACCESS_GROUPS)))
                .thenReturn(OidcRoleResolver.AccessLevel.NONE);

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "public", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<UserAccess> result = store.getGrantsForUser("testuser");

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getNamespace(), equalTo("public"));
    }

    @Test
    void return_empty_grants_when_no_namespaces() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        List<UserAccess> result = store.getGrantsForUser("testuser");

        assertThat(result, is(empty()));
    }

    @Test
    void throw_user_access_not_found_when_no_access() {
        when(roleResolver.resolve(eq(identity), any())).thenReturn(OidcRoleResolver.AccessLevel.NONE);
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        assertThrows(UserAccessNotFoundException.class,
                () -> store.getUserAccessForUsername("testuser"));
    }

    @Test
    void throw_user_access_not_found_when_no_namespaces() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(UserAccessNotFoundException.class,
                () -> store.getUserAccessForUsername("testuser"));
    }

    @Test
    void throw_unsupported_on_get_user_access_for_namespace() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getUserAccessForNamespace("finos"));
    }

    @Test
    void throw_unsupported_on_get_user_access_for_namespace_and_id() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getUserAccessForNamespaceAndId("finos", 1));
    }

    @Test
    void throw_unsupported_on_get_user_access_for_domain() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getUserAccessForDomain("security"));
    }

    @Test
    void throw_unsupported_on_get_user_access_for_domain_and_id() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getUserAccessForDomainAndId("security", 1));
    }

    @Test
    void throw_unsupported_on_create_user_access_for_namespace() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createUserAccessForNamespace(new UserAccess()));
    }

    @Test
    void throw_unsupported_on_create_user_access_for_domain() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createUserAccessForDomain(new UserAccess()));
    }

    @Test
    void throw_unsupported_on_delete_user_access_for_namespace() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteUserAccessForNamespace("finos", 1));
    }

    @Test
    void throw_unsupported_on_delete_user_access_for_domain() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteUserAccessForDomain("security", 1));
    }

    @Test
    void no_op_on_delete_all_user_access_for_namespace() {
        assertDoesNotThrow(() -> store.deleteAllUserAccessForNamespace("finos"));
    }

    @Test
    void no_op_on_delete_all_user_access_for_domain() {
        assertDoesNotThrow(() -> store.deleteAllUserAccessForDomain("security"));
    }
}
