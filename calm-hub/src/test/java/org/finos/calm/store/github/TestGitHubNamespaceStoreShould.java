package org.finos.calm.store.github;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubNamespaceStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubNamespaceStore store;

    @BeforeEach
    void setup() {
        store = new GitHubNamespaceStore(registryService);
    }

    @Test
    void return_namespaces_from_registry() {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(), "team", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<NamespaceInfo> result = store.getNamespaces();

        assertThat(result, hasSize(2));
    }

    @Test
    void return_true_when_namespace_exists() {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        assertThat(store.namespaceExists("finos"), is(true));
    }

    @Test
    void return_false_when_namespace_does_not_exist() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThat(store.namespaceExists("nonexistent"), is(false));
    }

    @Test
    void throw_on_create_namespace() {
        UnsupportedOperationException ex = assertThrows(UnsupportedOperationException.class,
                () -> store.createNamespace("new-ns", "desc"));
        assertThat(ex.getMessage().contains("admin-configured"), is(true));
    }

    @Test
    void throw_on_update_namespace_description() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updateNamespaceDescription("finos", "new desc"));
    }

    @Test
    void throw_on_delete_namespace() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteNamespace("finos"));
    }
}
