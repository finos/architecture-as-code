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
import org.finos.calm.domain.configs.ConfigDefault;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.CreateConfigRequest;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigVersionExistsException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ConfigStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.CanonicalVersion;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;
import java.util.Optional;

@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoConfigStore.class)
public class MongoConfigStore implements ConfigStore {

    static final String HEADER_COLLECTION = "configs";
    static final String VERSION_COLLECTION = "configVersions";
    static final String DEFAULT_COLLECTION = "configDefaults";
    static final String ID_FIELD = "configId";
    static final String TYPE_FIELD = "configType";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String VERSION_FIELD = "version";

    private final MongoDatabase database;
    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;

    public MongoConfigStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.database = database;
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
    }

    @Override
    public List<NamespaceResourceSummary> getConfigsForNamespace(String namespace, ConfigType type)
            throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return store(type).listSummariesPaged(namespace, PageRequest.UNPAGED);
    }

    @Override
    public int createConfigForNamespace(CreateConfigRequest request, String namespace, ConfigType type)
            throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        int id = counterStore.getNextConfigSequenceValue();
        MongoVersionDocumentStore store = store(type);
        store.createHeader(namespace, id, request.getName(), request.getDescription());
        store.createFirstVersion(namespace, id, Document.parse(request.getConfigJson()));
        return id;
    }

    @Override
    public List<String> getConfigVersions(String namespace, ConfigType type, int id)
            throws NamespaceNotFoundException, ConfigNotFoundException {
        return requireConfig(namespace, type, id).listVersions(namespace, id);
    }

    @Override
    public String getConfigForVersion(String namespace, ConfigType type, int id, String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionNotFoundException {
        Document content = requireConfig(namespace, type, id).getVersion(namespace, id, version);
        if (content == null) {
            throw new ConfigVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public void createConfigForVersion(CreateConfigRequest request, String namespace, ConfigType type, int id,
                                       String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionExistsException {
        MongoVersionDocumentStore store = requireConfig(namespace, type, id);
        if (!store.createVersion(namespace, id, version, Document.parse(request.getConfigJson()))) {
            throw new ConfigVersionExistsException();
        }
        store.updatePresentHeaderDetails(namespace, id, request.getName(), request.getDescription());
    }

    @Override
    public Optional<ConfigDefault> getDefault(String namespace, ConfigType type) {
        Document stored = defaults().find(defaultFilter(namespace, type)).first();
        return Optional.ofNullable(stored)
                .map(d -> new ConfigDefault(type.getName(), namespace, d.getInteger(ID_FIELD), d.getString(VERSION_FIELD)));
    }

    @Override
    public ConfigDefault setDefault(String namespace, ConfigType type, int id, String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionNotFoundException {
        if (requireConfig(namespace, type, id).getVersion(namespace, id, version) == null) {
            throw new ConfigVersionNotFoundException();
        }
        String canonical = CanonicalVersion.of(version);
        defaults().replaceOne(defaultFilter(namespace, type),
                new Document(NAMESPACE_FIELD, namespace)
                        .append(TYPE_FIELD, type.getName())
                        .append(ID_FIELD, id)
                        .append(VERSION_FIELD, canonical),
                new ReplaceOptions().upsert(true));
        return new ConfigDefault(type.getName(), namespace, id, canonical);
    }

    @Override
    public boolean deleteDefault(String namespace, ConfigType type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return defaults().deleteOne(defaultFilter(namespace, type)).getDeletedCount() > 0;
    }

    @Override
    public boolean hasContent(String namespace) {
        Bson filter = Filters.eq(NAMESPACE_FIELD, namespace);
        return database.getCollection(HEADER_COLLECTION).countDocuments(filter) > 0
                || defaults().countDocuments(filter) > 0;
    }

    private MongoVersionDocumentStore store(ConfigType type) {
        return new MongoVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION), database.getCollection(VERSION_COLLECTION), ID_FIELD,
                "Config", TYPE_FIELD, type.getName());
    }

    private MongoVersionDocumentStore requireConfig(String namespace, ConfigType type, int id)
            throws NamespaceNotFoundException, ConfigNotFoundException {
        namespaceStore.requireNamespace(namespace);
        MongoVersionDocumentStore store = store(type);
        if (!store.headerExists(namespace, id)) {
            throw new ConfigNotFoundException();
        }
        return store;
    }

    private MongoCollection<Document> defaults() {
        return database.getCollection(DEFAULT_COLLECTION);
    }

    private static Bson defaultFilter(String namespace, ConfigType type) {
        return Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(TYPE_FIELD, type.getName()));
    }
}
