package org.finos.calm.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.finos.calm.domain.Document;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DocumentStore;

import java.util.List;

@ApplicationScoped
public class DocumentService {
    private final DocumentStore documentStore;

    @Inject
    public DocumentService(DocumentStore documentStore) {
        this.documentStore = documentStore;
    }

    public List<Integer> getDocumentsForNamespace(String namespace, String type)
            throws NamespaceNotFoundException {
        return documentStore.getDocumentsForNamespace(namespace, type);
    }

    public Document createDocumentForNamespace(
            CreateDocumentRequest request, String namespace, String type)
            throws NamespaceNotFoundException {
        return documentStore.createDocumentForNamespace(request, namespace, type);
    }

    public List<String> getDocumentVersions(String namespace, String type, Integer id)
            throws NamespaceNotFoundException, DocumentNotFoundException {
        return documentStore.getDocumentVersions(namespace, type, id);
    }

    public String getDocumentForVersion(String namespace, String type, Integer id, String version)
            throws NamespaceNotFoundException,
                    DocumentNotFoundException,
                    DocumentVersionNotFoundException {
        return documentStore.getDocumentForVersion(namespace, type, id, version);
    }

    public Document createDocumentForVersion(
            CreateDocumentRequest request,
            String namespace,
            String type,
            Integer id,
            String version)
            throws NamespaceNotFoundException,
                    DocumentNotFoundException,
                    DocumentVersionExistsException {
        return documentStore.createDocumentForVersion(request, namespace, type, id, version);
    }
}
