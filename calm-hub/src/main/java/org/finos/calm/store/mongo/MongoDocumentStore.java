package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DocumentStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;

@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoDocumentStore.class)
public class MongoDocumentStore implements DocumentStore {

    private static final String HEADER_COLLECTION = "documents";
    private static final String VERSION_COLLECTION = "documentVersions";
    private static final String ID_FIELD = "documentId";
    private static final String TYPE_FIELD = "documentType";
    private static final String MARKDOWN_FIELD = "documentMarkdown";

    private final MongoDatabase database;
    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;

    public MongoDocumentStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.database = database;
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
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
        MongoVersionDocumentStore store = store(documentType);
        store.createHeader(namespace, documentId, request.getName(), request.getDescription());
        store.createFirstVersion(namespace, documentId, markdown(request));
        return response(request, documentId, MongoVersionDocumentStore.INITIAL_VERSION);
    }

    @Override
    public List<String> getDocumentVersions(String namespace, String documentType, Integer documentId)
            throws NamespaceNotFoundException, DocumentNotFoundException {
        MongoVersionDocumentStore store = requireDocument(namespace, documentType, documentId);
        return store.listVersions(namespace, documentId);
    }

    @Override
    public String getDocumentForVersion(String namespace, String documentType, Integer documentId, String version)
            throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionNotFoundException {
        MongoVersionDocumentStore store = requireDocument(namespace, documentType, documentId);
        Document content = store.getVersion(namespace, documentId, version);
        String markdown = content == null ? null : content.getString(MARKDOWN_FIELD);
        if (markdown == null) {
            throw new DocumentVersionNotFoundException();
        }
        return markdown;
    }

    @Override
    public org.finos.calm.domain.Document createDocumentForVersion(
            CreateDocumentRequest request, String namespace, String documentType, Integer documentId, String version)
            throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionExistsException {
        MongoVersionDocumentStore store = requireDocument(namespace, documentType, documentId);
        if (!store.createVersion(namespace, documentId, version, markdown(request))) {
            throw new DocumentVersionExistsException();
        }
        store.updateHeaderDetails(namespace, documentId, request.getName(), request.getDescription());
        return response(request, documentId, version);
    }

    private MongoVersionDocumentStore store(String documentType) {
        return new MongoVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION), database.getCollection(VERSION_COLLECTION), ID_FIELD,
                "Document", TYPE_FIELD, documentType);
    }

    private MongoVersionDocumentStore requireDocument(String namespace, String documentType, Integer documentId)
            throws NamespaceNotFoundException, DocumentNotFoundException {
        requireNamespace(namespace);
        MongoVersionDocumentStore store = store(documentType);
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
        return new Document(MARKDOWN_FIELD, request.getDocumentMarkdown());
    }

    private static org.finos.calm.domain.Document response(CreateDocumentRequest request, int documentId, String version) {
        org.finos.calm.domain.Document document = new org.finos.calm.domain.Document(request);
        document.setId(documentId);
        document.setVersion(version);
        return document;
    }
}
