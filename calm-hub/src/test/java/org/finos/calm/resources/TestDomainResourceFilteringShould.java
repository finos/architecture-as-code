package org.finos.calm.resources;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.inject.Instance;
import jakarta.ws.rs.core.Response;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.services.CountsService;
import org.finos.calm.services.DomainService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests that {@link DomainResource#getDomainCounts()} resolves the caller's readable
 * domains and passes them to {@link CountsService}, mirroring {@link SearchResource}.
 * Global-admin / no-auth / public-read collapse to {@link Optional#empty()} (see everything);
 * an authenticated caller with a subset of DOMAIN_READ grants is filtered to that subset.
 */
@ExtendWith(MockitoExtension.class)
class TestDomainResourceFilteringShould {

    @Mock
    private DomainService mockDomainService;

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
    private ArgumentCaptor<Optional<Set<String>>> domainsCaptor() {
        return ArgumentCaptor.forClass((Class) Optional.class);
    }

    private DomainResource resourceWithAuth(boolean authEnabled) {
        DomainResource resource = new DomainResource(mockDomainService, mockCountsService, mockValidatorInstance);
        resource.identity = mockIdentity;
        resource.authEnabled = authEnabled;
        return resource;
    }

    @Test
    void pass_resolved_readable_domains_to_counts_service_when_auth_enabled() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("testuser");
        when(mockValidatorInstance.get()).thenReturn(mockValidator);
        when(mockValidator.getReadableDomains("testuser")).thenReturn(Optional.of(Set.of("security")));
        when(mockCountsService.getDomainCounts(any())).thenReturn(List.of());

        Response response = resourceWithAuth(true).getDomainCounts();

        assertEquals(200, response.getStatus());
        ArgumentCaptor<Optional<Set<String>>> captor = domainsCaptor();
        verify(mockCountsService).getDomainCounts(captor.capture());
        assertTrue(captor.getValue().isPresent(), "auth-enabled call must pass a populated Optional");
        assertEquals(Set.of("security"), captor.getValue().get());
    }

    @Test
    void pass_empty_optional_when_auth_disabled() {
        when(mockCountsService.getDomainCounts(any())).thenReturn(List.of());

        resourceWithAuth(false).getDomainCounts();

        ArgumentCaptor<Optional<Set<String>>> captor = domainsCaptor();
        verify(mockCountsService).getDomainCounts(captor.capture());
        assertFalse(captor.getValue().isPresent());
    }

    @Test
    void pass_empty_optional_when_validator_not_resolvable() {
        when(mockValidatorInstance.isResolvable()).thenReturn(false);
        when(mockCountsService.getDomainCounts(any())).thenReturn(List.of());

        resourceWithAuth(true).getDomainCounts();

        ArgumentCaptor<Optional<Set<String>>> captor = domainsCaptor();
        verify(mockCountsService).getDomainCounts(captor.capture());
        assertFalse(captor.getValue().isPresent());
    }

    @Test
    void pass_empty_set_when_user_has_no_domain_grants() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("testuser");
        when(mockValidatorInstance.get()).thenReturn(mockValidator);
        when(mockValidator.getReadableDomains("testuser")).thenReturn(Optional.of(Set.of()));
        when(mockCountsService.getDomainCounts(any())).thenReturn(List.of());

        resourceWithAuth(true).getDomainCounts();

        ArgumentCaptor<Optional<Set<String>>> captor = domainsCaptor();
        verify(mockCountsService).getDomainCounts(captor.capture());
        assertTrue(captor.getValue().isPresent());
        assertTrue(captor.getValue().get().isEmpty());
    }
}
