package org.finos.calm.services;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.NamespaceParentNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.UserAccessStore;

import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestNamespaceServiceShould {

    @Mock
    NamespaceStore mockNamespaceStore;

    @Mock
    UserAccessStore mockUserAccessStore;

    NamespaceService service;

    @BeforeEach
    void setUp() {
        service = new NamespaceService(mockNamespaceStore, mockUserAccessStore);
    }

    @Test
    void get_namespaces_delegates_to_store() {
        List<NamespaceInfo> expected = List.of(new NamespaceInfo("org", "org namespace"));
        when(mockNamespaceStore.getNamespaces()).thenReturn(expected);

        List<NamespaceInfo> result = service.getNamespaces();

        assertThat(result, hasSize(1));
        verify(mockNamespaceStore).getNamespaces();
    }

    @Test
    void create_namespace_and_insert_wildcard_read_grant() throws Exception {
        service.createNamespace("myteam", "description");

        verify(mockNamespaceStore).createNamespace("myteam", "description");

        ArgumentCaptor<UserAccess> captor = ArgumentCaptor.forClass(UserAccess.class);
        verify(mockUserAccessStore).createUserAccessForNamespace(captor.capture());
        UserAccess grant = captor.getValue();
        assertThat(grant.getUsername(), is("*"));
        assertThat(grant.getPermission(), is(UserAccess.Permission.read));
        assertThat(grant.getNamespace(), is("myteam"));
    }

    @Test
    void propagate_namespace_already_exists_exception_and_skip_grant() throws Exception {
        doThrow(new NamespaceAlreadyExistsException("already exists"))
                .when(mockNamespaceStore).createNamespace("myteam", "desc");

        assertThrows(NamespaceAlreadyExistsException.class,
                () -> service.createNamespace("myteam", "desc"));

        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void log_warning_and_continue_when_grant_insertion_fails() throws Exception {
        doThrow(new NamespaceNotFoundException())
                .when(mockUserAccessStore).createUserAccessForNamespace(any());

        // should not throw — grant insertion failure is non-fatal
        service.createNamespace("myteam", "desc");

        verify(mockNamespaceStore).createNamespace("myteam", "desc");
    }

    @Test
    void throw_parent_not_found_when_direct_parent_does_not_exist() throws NamespaceAlreadyExistsException {
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of());

        assertThrows(NamespaceParentNotFoundException.class,
                () -> service.createNamespace("org.ab", "desc"));

        verify(mockNamespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void throw_parent_not_found_when_grandparent_exists_but_direct_parent_does_not() throws NamespaceAlreadyExistsException {
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(new NamespaceInfo("org", "org")));

        assertThrows(NamespaceParentNotFoundException.class,
                () -> service.createNamespace("org.ab.cd", "desc"));

        verify(mockNamespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void create_child_namespace_successfully_when_direct_parent_exists() throws NamespaceAlreadyExistsException {
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(new NamespaceInfo("org", "org")));

        service.createNamespace("org.ab", "desc");

        verify(mockNamespaceStore).createNamespace("org.ab", "desc");
    }

    @Test
    void skip_parent_check_for_top_level_namespaces() throws NamespaceAlreadyExistsException {
        service.createNamespace("newteam", "desc");

        verify(mockNamespaceStore, never()).getNamespaces();
        verify(mockNamespaceStore).createNamespace("newteam", "desc");
    }
}
