package org.finos.calm.store.github;

import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.access.NamespaceAccessFilter;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubDomainStoreShould {

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private NamespaceAccessFilter accessFilter;

    private GitHubDomainStore store;

    @BeforeEach
    void setup() {
        store = new GitHubDomainStore(registryService, accessFilter);
    }

    @Test
    void return_domains_derived_from_controls_directory() {
        RegistryEntry entry = new RegistryEntry("tls-policy", Path.of("controls/security/tls-policy.json"),
                RegistryResourceType.CONTROL, "TLS Policy", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:tls-policy", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        List<String> domains = store.getDomains();

        assertThat(domains, contains("security"));
    }

    @Test
    void return_empty_when_no_controls_exist() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of());

        List<String> domains = store.getDomains();

        assertThat(domains, is(empty()));
    }

    @Test
    void return_true_when_domain_exists() {
        RegistryEntry entry = new RegistryEntry("ctrl", Path.of("controls/security/ctrl.json"),
                RegistryResourceType.CONTROL, "Ctrl", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:ctrl", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        assertThat(store.domainExists("security"), is(true));
    }

    @Test
    void return_false_when_domain_does_not_exist() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of());

        assertThat(store.domainExists("nonexistent"), is(false));
    }

    @Test
    void hide_domains_from_inaccessible_namespaces() {
        RegistryEntry accessibleEntry = new RegistryEntry("ctrl-a", Path.of("controls/security/ctrl-a.json"),
                RegistryResourceType.CONTROL, "Control A", Instant.now());
        RegistryEntry restrictedEntry = new RegistryEntry("ctrl-b", Path.of("controls/compliance/ctrl-b.json"),
                RegistryResourceType.CONTROL, "Control B", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(accessibleEntry), "private", List.of(restrictedEntry)),
                Map.of("finos:ctrl-a", accessibleEntry, "private:ctrl-b", restrictedEntry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(accessFilter.getAccessibleNamespaces()).thenReturn(Set.of("finos"));

        List<String> domains = store.getDomains();

        assertThat(domains, contains("security"));
    }

    @Test
    void throw_on_create_domain() {
        assertThrows(UnsupportedOperationException.class, () -> store.createDomain("new-domain"));
    }

    @Test
    void throw_on_delete_domain() {
        assertThrows(UnsupportedOperationException.class, () -> store.deleteDomain("security"));
    }
}
