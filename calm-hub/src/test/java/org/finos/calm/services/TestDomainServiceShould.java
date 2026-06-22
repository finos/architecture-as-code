package org.finos.calm.services;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestDomainServiceShould {

    @Mock
    DomainStore mockDomainStore;

    @Mock
    UserAccessStore mockUserAccessStore;

    DomainService service;

    @BeforeEach
    void setUp() {
        service = new DomainService(mockDomainStore, mockUserAccessStore);
    }

    @Test
    void get_domains_delegates_to_store() {
        when(mockDomainStore.getDomains()).thenReturn(List.of("retail", "wholesale"));

        List<String> result = service.getDomains();

        assertThat(result, hasSize(2));
        verify(mockDomainStore).getDomains();
    }

    @Test
    void create_domain_and_insert_wildcard_read_grant() throws Exception {
        service.createDomain("retail");

        verify(mockDomainStore).createDomain("retail");

        ArgumentCaptor<UserAccess> captor = ArgumentCaptor.forClass(UserAccess.class);
        verify(mockUserAccessStore).createUserAccessForDomain(captor.capture());
        UserAccess grant = captor.getValue();
        assertThat(grant.getUsername(), is("*"));
        assertThat(grant.getPermission(), is(UserAccess.Permission.read));
        assertThat(grant.getDomain(), is("retail"));
    }

    @Test
    void propagate_domain_already_exists_exception_and_skip_grant() throws Exception {
        doThrow(new DomainAlreadyExistsException("already exists"))
                .when(mockDomainStore).createDomain("retail");

        assertThrows(DomainAlreadyExistsException.class,
                () -> service.createDomain("retail"));

        verify(mockUserAccessStore, never()).createUserAccessForDomain(any());
    }

    @Test
    void log_warning_and_continue_when_grant_insertion_fails() throws Exception {
        doThrow(new RuntimeException("store error"))
                .when(mockUserAccessStore).createUserAccessForDomain(any());

        // should not throw — grant insertion failure is non-fatal
        service.createDomain("retail");

        verify(mockDomainStore).createDomain("retail");
    }
}
