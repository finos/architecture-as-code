package org.finos.calm.services;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.config.PersonalNamespacesConfig;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.domain.namespaces.PersonalNamespace;
import org.finos.calm.services.PersonalNamespaceService.CreateOutcome;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestPersonalNamespaceServiceShould {

    private static final String ROOT = "users";

    @Mock
    PersonalNamespacesConfig mockConfig;

    @Mock
    NamespaceService mockNamespaceService;

    @Mock
    NamespaceStore mockNamespaceStore;

    @Mock
    UserAccessStore mockUserAccessStore;

    @BeforeEach
    void setUp() {
        when(mockConfig.enabled()).thenReturn(true);
        when(mockConfig.root()).thenReturn(ROOT);
        rootIsReady();
    }

    private void rootIsReady() {
        when(mockNamespaceStore.namespaceExists(ROOT)).thenReturn(true);
        try {
            when(mockUserAccessStore.getUserAccessForNamespace(ROOT))
                    .thenReturn(List.of(new UserAccess("*", UserAccess.Permission.read, ROOT)));
        } catch (NamespaceNotFoundException e) {
            throw new IllegalStateException(e);
        }
    }

    private PersonalNamespaceService service(boolean authEnabled, boolean allowPublicRead, boolean readOnly, String mode) {
        return new PersonalNamespaceService(mockConfig, mockNamespaceService, mockNamespaceStore, mockUserAccessStore,
                authEnabled, allowPublicRead, readOnly, mode);
    }

    private PersonalNamespaceService activeService() {
        return service(true, false, false, DatabaseMode.MONGO);
    }

    static Stream<Arguments> provideModes() {
        return Stream.of(
                Arguments.of(true, true, false, DatabaseMode.MONGO, true),
                Arguments.of(true, true, false, DatabaseMode.STANDALONE, true),
                Arguments.of(false, true, false, DatabaseMode.MONGO, false),
                Arguments.of(true, false, false, DatabaseMode.MONGO, false),
                Arguments.of(true, true, true, DatabaseMode.STANDALONE, false),
                Arguments.of(true, true, false, DatabaseMode.GITHUB, false)
        );
    }

    @ParameterizedTest
    @MethodSource("provideModes")
    void be_active_only_when_enabled_with_auth_and_writes(boolean enabled, boolean authEnabled, boolean readOnly,
                                                         String mode, boolean expected) {
        when(mockConfig.enabled()).thenReturn(enabled);

        assertThat(service(authEnabled, false, readOnly, mode).isActive(), is(expected));
    }

    @Test
    void be_inactive_when_the_root_is_missing() {
        when(mockNamespaceStore.namespaceExists(ROOT)).thenReturn(false);

        assertThat(activeService().isActive(), is(false));
    }

    @Test
    void be_inactive_when_the_root_has_no_public_read_grant() throws Exception {
        when(mockUserAccessStore.getUserAccessForNamespace(ROOT))
                .thenReturn(List.of(new UserAccess("admin", UserAccess.Permission.admin, ROOT)));

        assertThat(activeService().isActive(), is(false));
    }

    static Stream<Arguments> providePrincipals() {
        return Stream.of(
                Arguments.of("alice", "users.alice"),
                Arguments.of("mark.scott", "users.mark-scott"),
                Arguments.of("mark.scott@example.com", "users.mark-scott-example-com"),
                Arguments.of("j_smith", "users.j-smith"),
                Arguments.of("Alice", "users.Alice"),
                Arguments.of("first-last", "users.first-last")
        );
    }

    @ParameterizedTest
    @MethodSource("providePrincipals")
    void map_a_principal_to_a_namespace(String principal, String expected) {
        assertThat(activeService().namespaceFor(principal), is(Optional.of(expected)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"alice smith", "alice/bob", "", "alice+1", "élise"})
    void not_map_a_principal_with_other_characters(String principal) {
        assertThat(activeService().namespaceFor(principal), is(Optional.empty()));
    }

    @Test
    void not_map_a_null_principal() {
        assertThat(activeService().namespaceFor(null), is(Optional.empty()));
    }

    @Test
    void reserve_children_of_the_root_only_when_active() {
        assertThat(activeService().isReserved("users.alice"), is(true));
        assertThat(activeService().isReserved("users"), is(false));
        assertThat(activeService().isReserved("usersx.alice"), is(false));
        assertThat(activeService().isReserved("users.alice.drafts"), is(false));
        assertThat(service(false, false, false, DatabaseMode.MONGO).isReserved("users.alice"), is(false));
    }

    @Test
    void report_a_namespace_that_does_not_exist() {
        when(mockNamespaceStore.namespaceExists("users.alice")).thenReturn(false);

        assertThat(activeService().get("alice"), is(Optional.of(new PersonalNamespace("users.alice", false, false))));
    }

    @Test
    void report_a_namespace_owned_by_the_caller() throws Exception {
        when(mockNamespaceStore.namespaceExists("users.alice")).thenReturn(true);
        when(mockUserAccessStore.getUserAccessForNamespace("users.alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.admin, "users.alice")));

        assertThat(activeService().get("alice"), is(Optional.of(new PersonalNamespace("users.alice", true, true))));
    }

    @Test
    void report_a_namespace_taken_by_another_principal() throws Exception {
        when(mockNamespaceStore.namespaceExists("users.mark-scott")).thenReturn(true);
        when(mockUserAccessStore.getUserAccessForNamespace("users.mark-scott"))
                .thenReturn(List.of(new UserAccess("mark.scott", UserAccess.Permission.admin, "users.mark-scott")));

        assertThat(activeService().get("mark-scott"),
                is(Optional.of(new PersonalNamespace("users.mark-scott", true, false))));
    }

    @Test
    void not_count_a_write_grant_as_ownership() throws Exception {
        when(mockNamespaceStore.namespaceExists("users.alice")).thenReturn(true);
        when(mockUserAccessStore.getUserAccessForNamespace("users.alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.write, "users.alice")));

        assertThat(activeService().get("alice").orElseThrow().owned(), is(false));
    }

    @Test
    void return_empty_from_get_for_an_unsupported_principal() {
        assertThat(activeService().get("alice smith"), is(Optional.empty()));
    }

    @Test
    void create_the_namespace_with_an_owner_grant_and_no_public_grant() throws Exception {
        assertThat(activeService().create("alice"), is(Optional.of(CreateOutcome.CREATED)));

        verify(mockNamespaceStore).createNamespace("users.alice", "Personal namespace for alice");
        ArgumentCaptor<UserAccess> captor = ArgumentCaptor.forClass(UserAccess.class);
        verify(mockUserAccessStore).createUserAccessForNamespace(captor.capture());
        UserAccess grant = captor.getValue();
        assertThat(grant.getUsername(), is("alice"));
        assertThat(grant.getPermission(), is(UserAccess.Permission.admin));
        assertThat(grant.getNamespace(), is("users.alice"));
        verify(mockUserAccessStore, times(1)).createUserAccessForNamespace(any());
        verifyNoInteractions(mockNamespaceService);
    }

    @Test
    void report_already_owned_and_not_grant_again() throws Exception {
        doThrow(new NamespaceAlreadyExistsException("exists")).when(mockNamespaceStore).createNamespace(anyString(), anyString());
        when(mockUserAccessStore.getUserAccessForNamespace("users.alice"))
                .thenReturn(List.of(new UserAccess("alice", UserAccess.Permission.admin, "users.alice")));

        assertThat(activeService().create("alice"), is(Optional.of(CreateOutcome.ALREADY_OWNED)));
        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void report_taken_and_never_grant_on_an_existing_namespace() throws Exception {
        doThrow(new NamespaceAlreadyExistsException("exists")).when(mockNamespaceStore).createNamespace(anyString(), anyString());
        when(mockUserAccessStore.getUserAccessForNamespace("users.mark-scott"))
                .thenReturn(List.of(new UserAccess("mark.scott", UserAccess.Permission.admin, "users.mark-scott")));

        assertThat(activeService().create("mark-scott"), is(Optional.of(CreateOutcome.TAKEN)));
        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void report_taken_when_the_namespace_vanishes_while_checking_the_owner() throws Exception {
        doThrow(new NamespaceAlreadyExistsException("exists")).when(mockNamespaceStore).createNamespace(anyString(), anyString());
        when(mockUserAccessStore.getUserAccessForNamespace("users.alice")).thenThrow(new NamespaceNotFoundException());

        assertThat(activeService().create("alice"), is(Optional.of(CreateOutcome.TAKEN)));
    }

    @Test
    void return_empty_from_create_for_an_unsupported_principal() throws Exception {
        assertThat(activeService().create("alice smith"), is(Optional.empty()));
        verify(mockNamespaceStore, never()).createNamespace(anyString(), anyString());
    }

    @Test
    void fail_when_the_namespace_disappears_before_the_owner_grant() throws Exception {
        when(mockUserAccessStore.createUserAccessForNamespace(any())).thenThrow(new NamespaceNotFoundException());

        assertThrows(IllegalStateException.class, () -> activeService().create("alice"));
    }

    @Test
    void delete_the_namespace_when_the_owner_grant_fails() throws Exception {
        when(mockUserAccessStore.createUserAccessForNamespace(any())).thenThrow(new RuntimeException("timeout"));

        assertThrows(IllegalStateException.class, () -> activeService().create("alice"));
        verify(mockNamespaceStore).deleteNamespace("users.alice");
    }

    @Test
    void still_fail_when_the_roll_back_fails_too() throws Exception {
        when(mockUserAccessStore.createUserAccessForNamespace(any())).thenThrow(new RuntimeException("timeout"));
        doThrow(new RuntimeException("still down")).when(mockNamespaceStore).deleteNamespace("users.alice");

        assertThrows(IllegalStateException.class, () -> activeService().create("alice"));
    }

    @Test
    void claim_a_namespace_that_this_principal_created_with_no_grants() throws Exception {
        doThrow(new NamespaceAlreadyExistsException("exists")).when(mockNamespaceStore).createNamespace(anyString(), anyString());
        when(mockUserAccessStore.getUserAccessForNamespace("users.alice")).thenReturn(List.of());
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("users.alice", "Personal namespace for alice")));

        assertThat(activeService().create("alice"), is(Optional.of(CreateOutcome.ALREADY_OWNED)));
        ArgumentCaptor<UserAccess> captor = ArgumentCaptor.forClass(UserAccess.class);
        verify(mockUserAccessStore).createUserAccessForNamespace(captor.capture());
        assertThat(captor.getValue().getUsername(), is("alice"));
        verify(mockNamespaceStore, never()).deleteNamespace(anyString());
    }

    @Test
    void not_claim_a_namespace_that_another_principal_created() throws Exception {
        doThrow(new NamespaceAlreadyExistsException("exists")).when(mockNamespaceStore).createNamespace(anyString(), anyString());
        when(mockUserAccessStore.getUserAccessForNamespace("users.mark-scott")).thenReturn(List.of());
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("users.mark-scott", "Personal namespace for mark.scott")));

        assertThat(activeService().create("mark-scott"), is(Optional.of(CreateOutcome.TAKEN)));
        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void not_delete_a_claimed_namespace_when_its_grant_fails() throws Exception {
        doThrow(new NamespaceAlreadyExistsException("exists")).when(mockNamespaceStore).createNamespace(anyString(), anyString());
        when(mockUserAccessStore.getUserAccessForNamespace("users.alice")).thenReturn(List.of());
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("users.alice", "Personal namespace for alice")));
        when(mockUserAccessStore.createUserAccessForNamespace(any())).thenThrow(new RuntimeException("timeout"));

        assertThrows(IllegalStateException.class, () -> activeService().create("alice"));
        verify(mockNamespaceStore, never()).deleteNamespace(anyString());
    }

    @Test
    void do_nothing_at_startup_when_not_enabled() {
        when(mockConfig.enabled()).thenReturn(false);

        service(true, false, false, DatabaseMode.MONGO).onStartup(null);

        verifyNoInteractions(mockNamespaceStore, mockNamespaceService, mockUserAccessStore);
    }

    @Test
    void do_nothing_at_startup_when_enabled_but_inactive() {
        service(false, false, false, DatabaseMode.MONGO).onStartup(null);

        verifyNoInteractions(mockNamespaceStore, mockNamespaceService, mockUserAccessStore);
    }

    @Test
    void fail_startup_for_an_invalid_root() {
        when(mockConfig.root()).thenReturn("bad_root");

        assertThrows(IllegalStateException.class, () -> activeService().onStartup(null));
    }

    @Test
    void create_the_root_at_startup_with_a_public_read_grant() throws Exception {
        when(mockNamespaceStore.namespaceExists(ROOT)).thenReturn(false);

        activeService().onStartup(null);

        verify(mockNamespaceService).createNamespace(ROOT, "Personal namespaces");
    }

    @Test
    void check_the_root_grants_when_another_instance_created_the_root() throws Exception {
        when(mockNamespaceStore.namespaceExists(ROOT)).thenReturn(false);
        doThrow(new NamespaceAlreadyExistsException("exists")).when(mockNamespaceService).createNamespace(anyString(), anyString());
        when(mockUserAccessStore.getUserAccessForNamespace(ROOT))
                .thenReturn(List.of(new UserAccess("*", UserAccess.Permission.read, ROOT)));

        activeService().onStartup(null);

        verify(mockUserAccessStore).getUserAccessForNamespace(ROOT);
    }

    @Test
    void keep_an_existing_root_and_not_change_its_grants() throws Exception {
        when(mockNamespaceStore.namespaceExists(ROOT)).thenReturn(true);
        when(mockUserAccessStore.getUserAccessForNamespace(ROOT)).thenReturn(List.of());

        service(true, true, false, DatabaseMode.MONGO).onStartup(null);

        verify(mockNamespaceService, never()).createNamespace(anyString(), anyString());
        verify(mockUserAccessStore, never()).createUserAccessForNamespace(any());
    }

    @Test
    void treat_a_missing_root_during_the_grant_check_as_no_public_read() throws Exception {
        when(mockNamespaceStore.namespaceExists(ROOT)).thenReturn(true);
        when(mockUserAccessStore.getUserAccessForNamespace(ROOT)).thenThrow(new NamespaceNotFoundException());

        assertDoesNotThrow(() -> activeService().onStartup(null));
    }

    @Test
    void not_stop_startup_when_the_store_fails() {
        when(mockNamespaceStore.namespaceExists(ROOT)).thenThrow(new RuntimeException("store down"));

        assertDoesNotThrow(() -> activeService().onStartup(null));
    }
}
