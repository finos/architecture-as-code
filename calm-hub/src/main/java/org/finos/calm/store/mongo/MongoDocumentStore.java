package org.finos.calm.store.mongo;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import com.mongodb.client.model.UpdateOptions;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import io.quarkus.arc.lookup.LookupIfProperty;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DocumentStore;

import java.util.ArrayList;
import java.math.BigInteger;
import java.util.List;
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoDocumentStore.class)
public class MongoDocumentStore implements DocumentStore {
    private static final String COLLECTION = "documents";
    private final MongoCollection<Document> collection;
    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;

    public MongoDocumentStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        collection = database.getCollection(COLLECTION);
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
    }

    @Override
    public List<Integer> getDocumentsForNamespace(String namespace, String documentType) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        Document root = root(namespace, documentType);
        if (root == null) return List.of();
        List<Integer> result = new ArrayList<>();
        for (Document document : root.getList("documents", Document.class)) {
            result.add(document.getInteger("documentId"));
        }
        result.sort(Integer::compareTo);
        return result;
    }

    @Override
    public org.finos.calm.domain.Document createDocumentForNamespace(CreateDocumentRequest request, String namespace, String documentType) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        int id = counterStore.getNextDocumentSequenceValue();
        Document item = item(request, id, "1-0-0");
        Bson filter = rootFilter(namespace, documentType);
        Bson update = Updates.push("documents", item);
        try {
            collection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch (MongoWriteException writeFailure) {
            if (writeFailure.getError().getCategory() != ErrorCategory.DUPLICATE_KEY) throw writeFailure;
            // A concurrent request owns the newly-created root now; retry only the append.
            if (collection.updateOne(filter, update).getMatchedCount() == 0) {
                throw new IllegalStateException("Document root was not found after duplicate-key create race", writeFailure);
            }
        }
        return result(request, id, "1.0.0");
    }

    @Override
    public List<String> getDocumentVersions(String namespace, String documentType, Integer id) throws NamespaceNotFoundException, DocumentNotFoundException {
        requireNamespace(namespace);
        Document document = document(namespace, documentType, id);
        if (document == null) throw new DocumentNotFoundException();
        return document.get("versions", Document.class).keySet().stream()
                .map(MongoDocumentStore::normalizeVersion).sorted(SEMANTIC_VERSION_COMPARATOR).toList();
    }

    @Override
    public String getDocumentForVersion(String namespace, String documentType, Integer id, String version) throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionNotFoundException {
        requireNamespace(namespace);
        Document document = document(namespace, documentType, id);
        if (document == null) throw new DocumentNotFoundException();
        String markdown = document.get("versions", Document.class).getString(normalizeVersion(version).replace('.', '-'));
        if (markdown == null) throw new DocumentVersionNotFoundException();
        return markdown;
    }

    @Override
    public org.finos.calm.domain.Document createDocumentForVersion(CreateDocumentRequest request, String namespace, String documentType, Integer id, String version) throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionExistsException {
        requireNamespace(namespace);
        String normalizedVersion = normalizeVersion(version);
        String key = normalizedVersion.replace('.', '-');
        if (document(namespace, documentType, id) == null) throw new DocumentNotFoundException();
        Bson filter = Filters.and(rootFilter(namespace, documentType), Filters.elemMatch("documents",
                Filters.and(Filters.eq("documentId", id), Filters.exists("versions." + key, false))));
        Bson update = Updates.combine(Updates.set("documents.$.name", request.getName()),
                Updates.set("documents.$.description", request.getDescription()),
                Updates.set("documents.$.versions." + key, request.getDocumentMarkdown()));
        if (collection.updateOne(filter, update).getMatchedCount() == 0) throw new DocumentVersionExistsException();
        return result(request, id, normalizedVersion);
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException { if (!namespaceStore.namespaceExists(namespace)) throw new NamespaceNotFoundException(); }
    private Bson rootFilter(String namespace, String documentType) { return Filters.and(Filters.eq("namespace", namespace), Filters.eq("documentType", documentType)); }
    private Document root(String namespace, String documentType) { return collection.find(rootFilter(namespace, documentType)).first(); }
    private Document document(String namespace, String type, Integer id) { Document root = root(namespace, type); if (root == null) return null; for (Document item : root.getList("documents", Document.class)) if (id.equals(item.getInteger("documentId"))) return item; return null; }
    private Document item(CreateDocumentRequest request, int id, String key) { return new Document("documentId", id).append("name", request.getName()).append("description", request.getDescription()).append("versions", new Document(key, request.getDocumentMarkdown())); }
    private org.finos.calm.domain.Document result(CreateDocumentRequest request, int id, String version) { org.finos.calm.domain.Document document = new org.finos.calm.domain.Document(request); document.setId(id); document.setVersion(version); return document; }
    private static final Pattern VERSION_PATTERN = Pattern.compile("^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$");
    private static String normalizeVersion(String version) { Matcher matcher = VERSION_PATTERN.matcher(version); if (!matcher.matches()) throw new IllegalArgumentException("Invalid document version"); return matcher.group(1) + "." + matcher.group(2) + "." + matcher.group(3); }
    private static final Comparator<String> SEMANTIC_VERSION_COMPARATOR = Comparator
            .comparing((String version) -> new BigInteger(version.split("\\.")[0]))
            .thenComparing(version -> new BigInteger(version.split("\\.")[1]))
            .thenComparing(version -> new BigInteger(version.split("\\.")[2]));
}
