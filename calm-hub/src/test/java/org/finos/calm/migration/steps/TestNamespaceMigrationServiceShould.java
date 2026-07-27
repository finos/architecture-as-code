package org.finos.calm.migration.steps;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestNamespaceMigrationServiceShould {

    @Mock
    NamespaceStore mockNamespaceStore;

    @Mock
    UserAccessStore mockUserAccessStore;

    NamespaceMigrationService service;

    @BeforeEach
    void setUp() {
        service = new NamespaceMigrationService(mockNamespaceStore, mockUserAccessStore);
    }

    @Test
    void report_one_as_its_from_version() {
        assertThat(service.fromVersion(), is(1));
    }

    // --- backfillIfNeeded unit tests ---

    @Test
    void inserts_wildcard_read_grant_when_namespace_has_no_grants() throws Exception {
        when(mockUserAccessStore.getUserAccessForNamespace("org"))
                .thenReturn(List.of());

        boolean result = service.backfillIfNeeded("org");

        assertTrue(result);
        ArgumentCaptor<UserAccess> captor = ArgumentCaptor.forClass(UserAccess.class);
        verify(mockUserAccessStore).createUserAccessForNamespace(captor.capture());
        assertThat(captor.getValue().getUsername(), is("*"));
        assertThat(captor.getValue().getPermission(), is(UserAccess.Permission.read));
        assertThat(captor.getValue().getNamespace(), is("org"));
    }

    @Test
    void skips_namespace_that_has_only_named_user_grants() throws Exception {
        // Named grants mean an admin configured this namespace intentionally — don't add * read
        UserAccess namedGrant = new UserAccess("bob", UserAccess.Permission.read, "org");
        when(mockUserAccessStore.getUserAccessForNamespace("org")).thenReturn(List.of(namedGrant));

        boolean result = service.backfillIfNeeded("org");

        assertFalse(result);
        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void skips_namespace_that_already_has_wildcard_read_grant() throws Exception {
        UserAccess wildcardGrant = new UserAccess("*", UserAccess.Permission.read, "org");
        when(mockUserAccessStore.getUserAccessForNamespace("org")).thenReturn(List.of(wildcardGrant));

        boolean result = service.backfillIfNeeded("org");

        assertFalse(result);
        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void skips_namespace_that_already_has_wildcard_write_grant() throws Exception {
        UserAccess wildcardWriteGrant = new UserAccess("*", UserAccess.Permission.write, "org");
        when(mockUserAccessStore.getUserAccessForNamespace("org")).thenReturn(List.of(wildcardWriteGrant));

        boolean result = service.backfillIfNeeded("org");

        assertFalse(result);
        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void skips_namespace_not_found_during_grant_check() throws Exception {
        when(mockUserAccessStore.getUserAccessForNamespace("org"))
                .thenThrow(new NamespaceNotFoundException());

        boolean result = service.backfillIfNeeded("org");

        assertFalse(result);
        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void returns_false_when_grant_insertion_fails() throws Exception {
        when(mockUserAccessStore.getUserAccessForNamespace("org"))
                .thenReturn(List.of());
        doThrow(new NamespaceNotFoundException())
                .when(mockUserAccessStore).createUserAccessForNamespace(any());

        boolean result = service.backfillIfNeeded("org");

        assertFalse(result);
    }

    // --- apply() integration of backfillIfNeeded ---

    @Test
    void backfills_multiple_namespaces_on_startup() throws Exception {
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("org", ""),
                new NamespaceInfo("org.ab", "")
        ));
        when(mockUserAccessStore.getUserAccessForNamespace(any()))
                .thenReturn(List.of());

        service.apply();

        verify(mockUserAccessStore, times(2)).createUserAccessForNamespace(any());
    }

    @Test
    void skips_already_migrated_namespaces_on_startup() throws Exception {
        UserAccess existing = new UserAccess("*", UserAccess.Permission.read, "org");
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(new NamespaceInfo("org", "")));
        when(mockUserAccessStore.getUserAccessForNamespace("org")).thenReturn(List.of(existing));

        service.apply();

        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void is_idempotent_when_run_twice() throws Exception {
        // First run: no grants → inserts
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(new NamespaceInfo("org", "")));
        when(mockUserAccessStore.getUserAccessForNamespace("org"))
                .thenReturn(List.of())
                .thenReturn(List.of(new UserAccess("*", UserAccess.Permission.read, "org")));

        service.apply();
        service.apply();

        // Grant inserted exactly once across both runs
        verify(mockUserAccessStore, times(1)).createUserAccessForNamespace(any());
    }
}
