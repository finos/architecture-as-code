package org.finos.calm.store.github.util;

import io.quarkus.security.identity.SecurityIdentity;
import org.finos.calm.security.OidcRoleResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestNamespaceAccessFilterShould {

    @Mock
    private SecurityIdentity identity;

    @Mock
    private Principal principal;

    @Mock
    private OidcRoleResolver roleResolver;

    @Mock
    private InMemoryRegistryService registryService;

    @Mock
    private GitHubCloneManager cloneManager;

    private NamespaceAccessFilter filter;

    @BeforeEach
    void setup() {
        filter = new NamespaceAccessFilter();
        filter.identity = identity;
        filter.roleResolver = roleResolver;
        filter.registryService = registryService;
        filter.cloneManager = cloneManager;
    }

    @Test
    void return_all_namespaces_when_auth_disabled() {
        filter.authEnabled = false;
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "private", List.of()),
                Map.of(), Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, containsInAnyOrder("finos", "private"));
    }

    @Test
    void return_empty_when_identity_is_anonymous() {
        filter.authEnabled = true;
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()), Map.of(), Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(identity.isAnonymous()).thenReturn(true);

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, is(empty()));
    }

    @Test
    void return_only_accessible_namespaces_based_on_oidc_groups() {
        filter.authEnabled = true;
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "private", List.of(), "restricted", List.of()),
                Map.of(), Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("testuser");

        when(cloneManager.getAccessGroupsForNamespace("finos")).thenReturn(Set.of("team-a"));
        when(cloneManager.getAccessGroupsForNamespace("private")).thenReturn(Set.of("team-b"));
        when(cloneManager.getAccessGroupsForNamespace("restricted")).thenReturn(Set.of("team-c"));

        when(roleResolver.resolve(eq(identity), eq(Set.of("team-a")))).thenReturn(OidcRoleResolver.AccessLevel.READ);
        when(roleResolver.resolve(eq(identity), eq(Set.of("team-b")))).thenReturn(OidcRoleResolver.AccessLevel.NONE);
        when(roleResolver.resolve(eq(identity), eq(Set.of("team-c")))).thenReturn(OidcRoleResolver.AccessLevel.READ);

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, containsInAnyOrder("finos", "restricted"));
    }

    @Test
    void return_empty_when_no_namespaces_match() {
        filter.authEnabled = true;
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("private", List.of()), Map.of(), Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("testuser");

        when(cloneManager.getAccessGroupsForNamespace("private")).thenReturn(Set.of("admins"));
        when(roleResolver.resolve(eq(identity), eq(Set.of("admins")))).thenReturn(OidcRoleResolver.AccessLevel.NONE);

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, is(empty()));
    }

    @Test
    void return_empty_when_no_namespaces_registered() {
        filter.authEnabled = true;
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("testuser");

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, is(empty()));
    }
}
