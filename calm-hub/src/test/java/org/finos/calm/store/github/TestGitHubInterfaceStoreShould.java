package org.finos.calm.store.github;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
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
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubInterfaceStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubInterfaceStore store;

    @BeforeEach
    void setup() {
        store = new GitHubInterfaceStore(registryService);
    }

    @Test
    void return_empty_interfaces_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<NamespaceInterfaceSummary> result = store.getInterfacesForNamespace("finos");

        assertThat(result, is(empty()));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getInterfacesForNamespace("nonexistent"));
    }

    @Test
    void throw_unsupported_on_create_interface() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createInterfaceForNamespace(new CreateInterfaceRequest(), "finos"));
    }

    @Test
    void throw_unsupported_on_get_interface_versions() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getInterfaceVersions("finos", 1));
    }

    @Test
    void throw_unsupported_on_get_interface_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getInterfaceForVersion("finos", 1, "1.0.0"));
    }

    @Test
    void throw_unsupported_on_create_interface_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createInterfaceForVersion(new CreateInterfaceRequest(), "finos", 1, "1.0.0"));
    }
}
