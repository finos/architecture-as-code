package org.finos.calm.store;

import java.util.List;
import org.finos.calm.domain.Document;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.*;

public interface DocumentStore {
    List<Integer> getDocumentsForNamespace(String namespace, String documentType) throws NamespaceNotFoundException;
    Document createDocumentForNamespace(CreateDocumentRequest request, String namespace, String documentType) throws NamespaceNotFoundException;
    List<String> getDocumentVersions(String namespace, String documentType, Integer id) throws NamespaceNotFoundException, DocumentNotFoundException;
    String getDocumentForVersion(String namespace, String documentType, Integer id, String version) throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionNotFoundException;
    Document createDocumentForVersion(CreateDocumentRequest request, String namespace, String documentType, Integer id, String version) throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionExistsException;
}
