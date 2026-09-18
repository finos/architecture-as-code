package org.finos.calm.store.nitrite;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.dizitart.no2.Nitrite;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TestNitriteDocumentStoreShould {

    private final CreateDocumentRequest request =
            new CreateDocumentRequest("name", "description", "---\r\ntitle: A\r\n---\r\nbody");
    private Nitrite database;
    private NitriteDocumentStore store;

    @BeforeEach
    void setup() {
        database = Nitrite.builder().openOrCreate();
        NitriteNamespaceStore namespaceStore = mock(NitriteNamespaceStore.class);
        NitriteCounterStore counterStore = mock(NitriteCounterStore.class);
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(counterStore.getNextDocumentSequenceValue()).thenReturn(7);
        store = new NitriteDocumentStore(database, namespaceStore, counterStore);
    }

    @AfterEach
    void close() {
        database.close();
    }

    @Test
    void store_and_retrieve_a_document_by_type_and_version() throws Exception {
        store.createDocumentForNamespace(request, "finos", "knowledge");

        assertThat(store.getDocumentsForNamespace("finos", "knowledge"), contains(7));
        assertThat(store.getDocumentVersions("finos", "knowledge", 7), contains("1.0.0"));
        assertThat(store.getDocumentForVersion("finos", "knowledge", 7, "1.0.0"), is(request.getDocumentMarkdown()));
    }

    @Test
    void isolate_document_types_and_reject_duplicate_versions() throws Exception {
        store.createDocumentForNamespace(request, "finos", "knowledge");
        assertThrows(DocumentNotFoundException.class, () -> store.getDocumentVersions("finos", "sad", 7));
        store.createDocumentForVersion(request, "finos", "knowledge", 7, "1.0.1");
        assertThrows(
                DocumentVersionExistsException.class,
                () -> store.createDocumentForVersion(request, "finos", "knowledge", 7, "1-0-1"));
    }
}
