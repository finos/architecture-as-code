package org.finos.calm.store.github;

import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
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
class TestGitHubDocumentStoreShould {

    @Mock
    private ResourceRegistry registryService;

    private GitHubDocumentStore store;

    @BeforeEach
    void setup() {
        store = new GitHubDocumentStore(registryService);
    }

    private void withNamespace(String namespace) {
        when(registryService.getSnapshot()).thenReturn(new RegistrySnapshot(Map.of(namespace, List.of()), Map.of()));
    }

    @Test
    void return_no_documents_for_a_known_namespace() throws NamespaceNotFoundException {
        withNamespace("finos");

        assertThat(store.getDocumentsForNamespace("finos", "any-type"), is(empty()));
    }

    @Test
    void throw_namespace_not_found_when_listing_documents_for_an_unknown_namespace() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class, () -> store.getDocumentsForNamespace("nope", "any-type"));
    }

    @Test
    void throw_document_not_found_for_versions_of_a_document_in_a_known_namespace() {
        withNamespace("finos");

        assertThrows(DocumentNotFoundException.class, () -> store.getDocumentVersions("finos", "any-type", 1));
    }

    @Test
    void throw_namespace_not_found_for_versions_in_an_unknown_namespace() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class, () -> store.getDocumentVersions("nope", "any-type", 1));
    }

    @Test
    void throw_document_not_found_for_a_specific_version_in_a_known_namespace() {
        withNamespace("finos");

        assertThrows(DocumentNotFoundException.class,
                () -> store.getDocumentForVersion("finos", "any-type", 1, "abc1234"));
    }

    @Test
    void throw_namespace_not_found_for_a_specific_version_in_an_unknown_namespace() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getDocumentForVersion("nope", "any-type", 1, "abc1234"));
    }

    @Test
    void reject_creating_a_document() {
        assertThrows(GitHubWriteNotSupportedException.class,
                () -> store.createDocumentForNamespace(null, "finos", "any-type"));
    }

    @Test
    void reject_creating_a_document_version() {
        assertThrows(GitHubWriteNotSupportedException.class,
                () -> store.createDocumentForVersion(null, "finos", "any-type", 1, "1.0.0"));
    }
}
