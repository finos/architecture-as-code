package org.finos.calm.resources;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.inject.Instance;
import org.finos.calm.domain.ValueWrapper;
import org.finos.calm.domain.namespaces.NamespaceCounts;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.services.CountsService;
import org.finos.calm.services.NamespaceService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.UserAccessStore;

import java.security.Principal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests that {@link NamespaceResource#namespaceCounts()} resolves the caller's readable
 * namespaces and passes them to {@link CountsService}, mirroring {@link SearchResource}.
 * Global-admin / no-auth / public-read collapse to {@link Optional#empty()} (see everything);
 * an authenticated caller with a subset of READ grants is filtered to that subset.
 */
@ExtendWith(MockitoExtension.class)
class TestNamespaceResourceFilteringShould {

    @Mock
    private NamespaceService mockNamespaceService;

    @Mock
    private CountsService mockCountsService;

    @Mock
    private Instance<UserAccessValidator> mockValidatorInstance;

    @Mock
    private UserAccessValidator mockValidator;

    @Mock
    private SecurityIdentity mockIdentity;

    @Mock
    private Principal mockPrincipal;

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ArgumentCaptor<Optional<Set<String>>> namespacesCaptor() {
        return ArgumentCaptor.forClass((Class) Optional.class);
    }

    private NamespaceResource resourceWithAuth(boolean authEnabled) {
        NamespaceResource resource = new NamespaceResource(mockNamespaceService, mockCountsService, mockValidatorInstance);
        resource.identity = mockIdentity;
        resource.authEnabled = authEnabled;
        return resource;
    }

    @Test
    void pass_resolved_readable_namespaces_to_counts_service_when_auth_enabled() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("testuser");
        when(mockValidatorInstance.get()).thenReturn(mockValidator);
        when(mockValidator.getReadableNamespaces("testuser")).thenReturn(Optional.of(Set.of("finos")));
        when(mockCountsService.getNamespaceCounts(any())).thenReturn(List.of());

        ValueWrapper<NamespaceCounts> result = resourceWithAuth(true).namespaceCounts();

        assertEquals(List.of(), result.getValues());
        ArgumentCaptor<Optional<Set<String>>> captor = namespacesCaptor();
        verify(mockCountsService).getNamespaceCounts(captor.capture());
        assertTrue(captor.getValue().isPresent(), "auth-enabled call must pass a populated Optional");
        assertEquals(Set.of("finos"), captor.getValue().get());
    }

    @Test
    void pass_empty_optional_when_auth_disabled() {
        when(mockCountsService.getNamespaceCounts(any())).thenReturn(List.of());

        resourceWithAuth(false).namespaceCounts();

        ArgumentCaptor<Optional<Set<String>>> captor = namespacesCaptor();
        verify(mockCountsService).getNamespaceCounts(captor.capture());
        assertFalse(captor.getValue().isPresent());
    }

    @Test
    void pass_empty_optional_when_validator_not_resolvable() {
        when(mockValidatorInstance.isResolvable()).thenReturn(false);
        when(mockCountsService.getNamespaceCounts(any())).thenReturn(List.of());

        resourceWithAuth(true).namespaceCounts();

        ArgumentCaptor<Optional<Set<String>>> captor = namespacesCaptor();
        verify(mockCountsService).getNamespaceCounts(captor.capture());
        assertFalse(captor.getValue().isPresent());
    }

    @Test
    void filter_namespaces_via_store_fallback_when_validator_not_resolvable() {
        when(mockValidatorInstance.isResolvable()).thenReturn(false);
        when(mockIdentity.isAnonymous()).thenReturn(false);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("testuser");

        UserAccessStore mockUserAccessStore = mock(UserAccessStore.class);
        UserAccess grant = new UserAccess("testuser", UserAccess.Permission.read, "finos");
        when(mockUserAccessStore.getGrantsForUser("testuser")).thenReturn(List.of(grant));

        when(mockNamespaceService.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("finos", "FINOS"),
                new NamespaceInfo("private", "Private")
        ));

        NamespaceResource resource = new NamespaceResource(mockNamespaceService, mockCountsService, mockValidatorInstance);
        resource.identity = mockIdentity;
        resource.authEnabled = true;
        resource.userAccessStore = mockUserAccessStore;

        var result = resource.namespaces();
        assertEquals(1, result.getValues().size());
        assertEquals("finos", result.getValues().get(0).getName());
    }

    @Test
    void return_all_namespaces_when_store_fallback_has_null_store() {
        when(mockValidatorInstance.isResolvable()).thenReturn(false);
        when(mockIdentity.isAnonymous()).thenReturn(false);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);

        when(mockNamespaceService.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("finos", "FINOS")
        ));

        NamespaceResource resource = new NamespaceResource(mockNamespaceService, mockCountsService, mockValidatorInstance);
        resource.identity = mockIdentity;
        resource.authEnabled = true;
        resource.userAccessStore = null;

        var result = resource.namespaces();
        assertEquals(1, result.getValues().size());
    }

    @Test
    void pass_empty_set_when_user_has_no_namespace_grants() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("testuser");
        when(mockValidatorInstance.get()).thenReturn(mockValidator);
        when(mockValidator.getReadableNamespaces("testuser")).thenReturn(Optional.of(Set.of()));
        when(mockCountsService.getNamespaceCounts(any())).thenReturn(List.of());

        resourceWithAuth(true).namespaceCounts();

        ArgumentCaptor<Optional<Set<String>>> captor = namespacesCaptor();
        verify(mockCountsService).getNamespaceCounts(captor.capture());
        assertTrue(captor.getValue().isPresent());
        assertTrue(captor.getValue().get().isEmpty());
    }
}
