package org.finos.calm.store.nitrite;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DocumentStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.NitriteVersionDocumentStore;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteDocumentStore.class)
public class NitriteDocumentStore implements DocumentStore {

    private static final String HEADER_COLLECTION = "documents";
    private static final String VERSION_COLLECTION = "documentVersions";
    private static final String ID_FIELD = "documentId";
    private static final String TYPE_FIELD = "documentType";
    private static final String MARKDOWN_FIELD = "documentMarkdown";

    private final Nitrite database;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final Map<String, NitriteVersionDocumentStore> stores = new ConcurrentHashMap<>();

    @Inject
    public NitriteDocumentStore(
            @StandaloneQualifier Nitrite database,
            NitriteNamespaceStore namespaceStore,
            NitriteCounterStore counterStore) {
        this.database = database;
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
    }

    @Override
    public List<Integer> getDocumentsForNamespace(String namespace, String documentType)
            throws NamespaceNotFoundException {
        requireNamespace(namespace);
        return store(documentType).listSummariesPaged(namespace, PageRequest.UNPAGED).stream()
                .map(summary -> summary.getId())
                .toList();
    }

    @Override
    public org.finos.calm.domain.Document createDocumentForNamespace(
            CreateDocumentRequest request, String namespace, String documentType)
            throws NamespaceNotFoundException {
        requireNamespace(namespace);
        int documentId = counterStore.getNextDocumentSequenceValue();
        NitriteVersionDocumentStore store = store(documentType);
        store.createHeader(namespace, documentId, request.getName(), request.getDescription());
        store.createFirstVersion(namespace, documentId, NitriteVersionDocumentStore.INITIAL_VERSION, markdown(request));
        return response(request, documentId, NitriteVersionDocumentStore.INITIAL_VERSION);
    }

    @Override
    public List<String> getDocumentVersions(String namespace, String documentType, Integer documentId)
            throws NamespaceNotFoundException, DocumentNotFoundException {
        NitriteVersionDocumentStore store = requireDocument(namespace, documentType, documentId);
        return store.listVersions(namespace, documentId);
    }

    @Override
    public String getDocumentForVersion(String namespace, String documentType, Integer documentId, String version)
            throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionNotFoundException {
        NitriteVersionDocumentStore store = requireDocument(namespace, documentType, documentId);
        Document content = store.getDocumentVersion(namespace, documentId, version);
        String markdown = content == null ? null : content.get(MARKDOWN_FIELD, String.class);
        if (markdown == null) {
            throw new DocumentVersionNotFoundException();
        }
        return markdown;
    }

    @Override
    public org.finos.calm.domain.Document createDocumentForVersion(
            CreateDocumentRequest request, String namespace, String documentType, Integer documentId, String version)
            throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionExistsException {
        NitriteVersionDocumentStore store = requireDocument(namespace, documentType, documentId);
        if (!store.createVersion(namespace, documentId, version, markdown(request))) {
            throw new DocumentVersionExistsException();
        }
        store.updateHeaderDetails(namespace, documentId, request.getName(), request.getDescription());
        return response(request, documentId, version);
    }

    private NitriteVersionDocumentStore store(String documentType) {
        return stores.computeIfAbsent(documentType, type -> new NitriteVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION), database.getCollection(VERSION_COLLECTION), ID_FIELD,
                "Document", TYPE_FIELD, type));
    }

    private NitriteVersionDocumentStore requireDocument(String namespace, String documentType, Integer documentId)
            throws NamespaceNotFoundException, DocumentNotFoundException {
        requireNamespace(namespace);
        NitriteVersionDocumentStore store = store(documentType);
        if (!store.headerExists(namespace, documentId)) {
            throw new DocumentNotFoundException();
        }
        return store;
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }

    private static Document markdown(CreateDocumentRequest request) {
        return Document.createDocument().put(MARKDOWN_FIELD, request.getDocumentMarkdown());
    }

    private static org.finos.calm.domain.Document response(CreateDocumentRequest request, int documentId, String version) {
        org.finos.calm.domain.Document document = new org.finos.calm.domain.Document(request);
        document.setId(documentId);
        document.setVersion(version);
        return document;
    }
}
