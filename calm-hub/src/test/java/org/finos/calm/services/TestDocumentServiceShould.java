package org.finos.calm.services;

import org.finos.calm.domain.Document;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.store.DocumentStore;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.*;

class TestDocumentServiceShould {
    @Test
    void delegate_document_operations_to_the_store() throws Exception {
        DocumentStore store = mock(DocumentStore.class);
        DocumentService service = new DocumentService(store);
        CreateDocumentRequest request = new CreateDocumentRequest("name", "description", "---\ntitle: A\n---\nbody");
        Document document = new Document(request);

        when(store.createDocumentForNamespace(request, "finos", "pattern")).thenReturn(document);
        when(store.createDocumentForVersion(request, "finos", "pattern", 1, "1.0.1")).thenReturn(document);

        service.getDocumentsForNamespace("finos", "pattern");
        service.createDocumentForNamespace(request, "finos", "pattern");
        service.getDocumentVersions("finos", "pattern", 1);
        service.getDocumentForVersion("finos", "pattern", 1, "1.0.0");
        service.createDocumentForVersion(request, "finos", "pattern", 1, "1.0.1");

        verify(store).getDocumentsForNamespace("finos", "pattern");
        verify(store).createDocumentForNamespace(request, "finos", "pattern");
        verify(store).getDocumentVersions("finos", "pattern", 1);
        verify(store).getDocumentForVersion("finos", "pattern", 1, "1.0.0");
        verify(store).createDocumentForVersion(request, "finos", "pattern", 1, "1.0.1");
    }
}
