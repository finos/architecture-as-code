package org.finos.calm.store.github;

import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.NamespaceAccessFilter;
import org.finos.calm.store.github.util.RegistryEntry;
import org.finos.calm.store.github.util.RegistrySnapshot;
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
    private InMemoryRegistryService registryService;

    @Mock
    private NamespaceAccessFilter accessFilter;

    private GitHubDomainStore store;

    @BeforeEach
    void setup() {
        store = new GitHubDomainStore(registryService);
        store.accessFilter = accessFilter;
    }

    @Test
    void return_domains_derived_from_controls_directory() {
        RegistryEntry entry = new RegistryEntry("tls-policy", Path.of("controls/security/tls-policy.json"),
                CalmResourceType.CONTROL, "TLS Policy", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:tls-policy", entry),
                Map.of(CalmResourceType.CONTROL, List.of(entry))
        );
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
                CalmResourceType.CONTROL, "Ctrl", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:ctrl", entry),
                Map.of(CalmResourceType.CONTROL, List.of(entry))
        );
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
                CalmResourceType.CONTROL, "Control A", Instant.now());
        RegistryEntry restrictedEntry = new RegistryEntry("ctrl-b", Path.of("controls/compliance/ctrl-b.json"),
                CalmResourceType.CONTROL, "Control B", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(accessibleEntry), "private", List.of(restrictedEntry)),
                Map.of("finos:ctrl-a", accessibleEntry, "private:ctrl-b", restrictedEntry),
                Map.of(CalmResourceType.CONTROL, List.of(accessibleEntry, restrictedEntry))
        );
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
