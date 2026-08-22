package org.finos.calm.store.github;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.security.GitHubRequestContext;
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
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestGitHubUserAccessStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    @Mock
    private GitHubRequestContext githubContext;

    private GitHubUserAccessStore store;

    @BeforeEach
    void setup() {
        store = new GitHubUserAccessStore();
        store.registryService = registryService;
        store.githubContext = githubContext;
    }

    @Test
    void return_empty_grants_when_not_linked() {
        when(githubContext.getToken()).thenReturn(Optional.empty());
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
    void return_write_grants_for_all_namespaces_when_linked() {
        when(githubContext.getToken()).thenReturn(Optional.of("gho_test_token"));
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "team", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<UserAccess> result = store.getGrantsForUser("testuser");

        assertThat(result, hasSize(2));
        assertThat(result.get(0).getPermission(), equalTo(UserAccess.Permission.write));
        assertThat(result.get(1).getPermission(), equalTo(UserAccess.Permission.write));
    }

    @Test
    void throw_user_access_not_found_when_not_linked() {
        when(githubContext.getToken()).thenReturn(Optional.empty());
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
        when(githubContext.getToken()).thenReturn(Optional.empty());
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
