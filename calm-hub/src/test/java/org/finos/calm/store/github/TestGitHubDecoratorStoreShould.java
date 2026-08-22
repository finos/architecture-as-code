package org.finos.calm.store.github;

import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubDecoratorStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubDecoratorStore store;

    @BeforeEach
    void setup() {
        store = new GitHubDecoratorStore(registryService);
    }

    @Test
    void return_empty_decorators_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<Integer> result = store.getDecoratorsForNamespace("finos", "target", "type");

        assertThat(result, is(empty()));
    }

    @Test
    void return_empty_decorator_values_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<Decorator> result = store.getDecoratorValuesForNamespace("finos", "target", "type");

        assertThat(result, is(empty()));
    }

    @Test
    void return_empty_optional_for_decorator_by_id() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        Optional<Decorator> result = store.getDecoratorById("finos", 1);

        assertThat(result, equalTo(Optional.empty()));
    }

    @Test
    void throw_namespace_not_found_on_get_decorators() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getDecoratorsForNamespace("nonexistent", "target", "type"));
    }

    @Test
    void throw_namespace_not_found_on_get_decorator_values() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getDecoratorValuesForNamespace("nonexistent", "target", "type"));
    }

    @Test
    void throw_namespace_not_found_on_get_decorator_by_id() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getDecoratorById("nonexistent", 1));
    }

    @Test
    void throw_unsupported_on_create_decorator() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createDecorator("finos", "{}"));
    }

    @Test
    void throw_unsupported_on_update_decorator() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updateDecorator("finos", 1, "{}"));
    }
}
