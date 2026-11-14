package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.ReplaceOptions;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.conventions.ConventionDefault;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.CreateConventionRequest;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionVersionExistsException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ConventionStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.CanonicalVersion;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;
import java.util.Optional;

@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoConventionStore.class)
public class MongoConventionStore implements ConventionStore {

    static final String HEADER_COLLECTION = "conventions";
    static final String VERSION_COLLECTION = "conventionVersions";
    static final String DEFAULT_COLLECTION = "conventionDefaults";
    static final String ID_FIELD = "conventionId";
    static final String TYPE_FIELD = "conventionType";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String VERSION_FIELD = "version";

    private final MongoDatabase database;
    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;

    public MongoConventionStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.database = database;
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
    }

    @Override
    public List<NamespaceResourceSummary> getConventionsForNamespace(String namespace, ConventionType type)
            throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return store(type).listSummariesPaged(namespace, PageRequest.UNPAGED);
    }

    @Override
    public int createConventionForNamespace(CreateConventionRequest request, String namespace, ConventionType type)
            throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        int id = counterStore.getNextConventionSequenceValue();
        MongoVersionDocumentStore store = store(type);
        store.createHeader(namespace, id, request.getName(), request.getDescription());
        store.createFirstVersion(namespace, id, Document.parse(request.getConventionJson()));
        return id;
    }

    @Override
    public List<String> getConventionVersions(String namespace, ConventionType type, int id)
            throws NamespaceNotFoundException, ConventionNotFoundException {
        return requireConvention(namespace, type, id).listVersions(namespace, id);
    }

    @Override
    public String getConventionForVersion(String namespace, ConventionType type, int id, String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException {
        Document content = requireConvention(namespace, type, id).getVersion(namespace, id, version);
        if (content == null) {
            throw new ConventionVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public void createConventionForVersion(CreateConventionRequest request, String namespace, ConventionType type, int id,
                                       String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionExistsException {
        MongoVersionDocumentStore store = requireConvention(namespace, type, id);
        if (!store.createVersion(namespace, id, version, Document.parse(request.getConventionJson()))) {
            throw new ConventionVersionExistsException();
        }
        store.updatePresentHeaderDetails(namespace, id, request.getName(), request.getDescription());
    }

    @Override
    public Optional<ConventionDefault> getDefault(String namespace, ConventionType type) {
        Document stored = defaults().find(defaultFilter(namespace, type)).first();
        return Optional.ofNullable(stored)
                .map(d -> new ConventionDefault(type.getName(), namespace, d.getInteger(ID_FIELD), d.getString(VERSION_FIELD)));
    }

    @Override
    public ConventionDefault setDefault(String namespace, ConventionType type, int id, String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException {
        if (requireConvention(namespace, type, id).getVersion(namespace, id, version) == null) {
            throw new ConventionVersionNotFoundException();
        }
        String canonical = CanonicalVersion.of(version);
        defaults().replaceOne(defaultFilter(namespace, type),
                new Document(NAMESPACE_FIELD, namespace)
                        .append(TYPE_FIELD, type.getName())
                        .append(ID_FIELD, id)
                        .append(VERSION_FIELD, canonical),
                new ReplaceOptions().upsert(true));
        return new ConventionDefault(type.getName(), namespace, id, canonical);
    }

    @Override
    public boolean deleteDefault(String namespace, ConventionType type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return defaults().deleteOne(defaultFilter(namespace, type)).getDeletedCount() > 0;
    }

    @Override
    public boolean hasContent(String namespace) {
        Bson filter = Filters.eq(NAMESPACE_FIELD, namespace);
        return database.getCollection(HEADER_COLLECTION).countDocuments(filter) > 0
                || defaults().countDocuments(filter) > 0;
    }

    private MongoVersionDocumentStore store(ConventionType type) {
        return new MongoVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION), database.getCollection(VERSION_COLLECTION), ID_FIELD,
                "Convention", TYPE_FIELD, type.getName());
    }

    private MongoVersionDocumentStore requireConvention(String namespace, ConventionType type, int id)
            throws NamespaceNotFoundException, ConventionNotFoundException {
        namespaceStore.requireNamespace(namespace);
        MongoVersionDocumentStore store = store(type);
        if (!store.headerExists(namespace, id)) {
            throw new ConventionNotFoundException();
        }
        return store;
    }

    private MongoCollection<Document> defaults() {
        return database.getCollection(DEFAULT_COLLECTION);
    }

    private static Bson defaultFilter(String namespace, ConventionType type) {
        return Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(TYPE_FIELD, type.getName()));
    }
}
