package org.finos.calm.store.github;

import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
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
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubAdrStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubAdrStore store;

    @BeforeEach
    void setup() {
        store = new GitHubAdrStore(registryService);
    }

    @Test
    void return_empty_adrs_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        List<NamespaceAdrSummary> result = store.getAdrsForNamespace("finos");

        assertThat(result, is(empty()));
    }

    @Test
    void return_zero_count_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);

        assertThat(store.countAdrsForNamespace("finos"), equalTo(0));
    }

    @Test
    void throw_namespace_not_found_on_get_adrs() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getAdrsForNamespace("nonexistent"));
    }

    @Test
    void throw_namespace_not_found_on_count_adrs() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.countAdrsForNamespace("nonexistent"));
    }

    @Test
    void throw_unsupported_on_create_adr() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createAdrForNamespace(new AdrMeta()));
    }

    @Test
    void throw_unsupported_on_get_adr() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getAdr(new AdrMeta()));
    }

    @Test
    void throw_unsupported_on_get_adr_revisions() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getAdrRevisions(new AdrMeta()));
    }

    @Test
    void throw_unsupported_on_get_adr_revision() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getAdrRevision(new AdrMeta()));
    }

    @Test
    void throw_unsupported_on_update_adr() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updateAdrForNamespace(new AdrMeta()));
    }

    @Test
    void throw_unsupported_on_update_adr_status() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updateAdrStatus(new AdrMeta(), Status.accepted));
    }
}
