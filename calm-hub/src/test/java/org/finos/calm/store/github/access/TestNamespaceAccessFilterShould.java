package org.finos.calm.store.github.access;

import io.quarkus.security.identity.SecurityIdentity;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestNamespaceAccessFilterShould {

    @Mock
    private SecurityIdentity identity;

    @Mock
    private Principal principal;

    @Mock
    private UserAccessValidator accessValidator;

    @Mock
    private ResourceRegistry registryService;

    private NamespaceAccessFilter filterWithAuth(boolean authEnabled) {
        return new NamespaceAccessFilter(identity, accessValidator, registryService, authEnabled);
    }

    @Test
    void return_all_namespaces_when_auth_disabled() {
        NamespaceAccessFilter filter = filterWithAuth(false);
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "private", List.of()),
                Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, containsInAnyOrder("finos", "private"));
    }

    @Test
    void return_empty_when_identity_is_anonymous() {
        NamespaceAccessFilter filter = filterWithAuth(true);
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()), Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(identity.isAnonymous()).thenReturn(true);

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, is(empty()));
    }

    @Test
    void return_only_the_namespaces_the_access_validator_says_are_readable() {
        NamespaceAccessFilter filter = filterWithAuth(true);
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "private", List.of(), "restricted", List.of()),
                Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("testuser");

        when(accessValidator.getReadableNamespaces("testuser"))
                .thenReturn(Optional.of(Set.of("finos", "restricted")));

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, containsInAnyOrder("finos", "restricted"));
    }

    @Test
    void return_every_registered_namespace_when_the_access_validator_says_everything_is_readable() {
        // Optional.empty() from UserAccessValidator means calm.auth.allow-public-read is
        // true, or the caller holds a GLOBAL admin grant - either way, every namespace the
        // registry actually knows about, not just the ones the caller has an explicit
        // grant for.
        NamespaceAccessFilter filter = filterWithAuth(true);
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "private", List.of()),
                Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("testuser");

        when(accessValidator.getReadableNamespaces("testuser")).thenReturn(Optional.empty());

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, containsInAnyOrder("finos", "private"));
    }

    @Test
    void exclude_a_readable_namespace_the_registry_no_longer_knows_about() {
        // UserAccessValidator's grants can be stale relative to the registry's current
        // snapshot (a namespace removed from calm.github.namespaces since the grant was
        // computed) - the accessible set must never include a namespace the caller
        // couldn't actually read anything from.
        NamespaceAccessFilter filter = filterWithAuth(true);
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()), Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("testuser");

        when(accessValidator.getReadableNamespaces("testuser"))
                .thenReturn(Optional.of(Set.of("finos", "removed-namespace")));

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, containsInAnyOrder("finos"));
    }

    @Test
    void return_empty_when_no_namespaces_are_readable() {
        NamespaceAccessFilter filter = filterWithAuth(true);
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("private", List.of()), Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("testuser");

        when(accessValidator.getReadableNamespaces("testuser")).thenReturn(Optional.of(Set.of()));

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, is(empty()));
    }

    @Test
    void return_empty_when_no_namespaces_registered() {
        NamespaceAccessFilter filter = filterWithAuth(true);
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn("testuser");

        when(accessValidator.getReadableNamespaces("testuser")).thenReturn(Optional.of(Set.of()));

        Set<String> result = filter.getAccessibleNamespaces();

        assertThat(result, is(empty()));
    }
}
