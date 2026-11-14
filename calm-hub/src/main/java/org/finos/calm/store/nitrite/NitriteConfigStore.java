package org.finos.calm.store.nitrite;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
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
import org.finos.calm.store.util.NitriteVersionDocumentStore;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import static org.dizitart.no2.filters.FluentFilter.where;

@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteConfigStore.class)
public class NitriteConfigStore implements ConfigStore {

    static final String HEADER_COLLECTION = "configs";
    static final String VERSION_COLLECTION = "configVersions";
    static final String DEFAULT_COLLECTION = "configDefaults";
    static final String ID_FIELD = "configId";
    static final String TYPE_FIELD = "configType";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String VERSION_FIELD = "version";

    private final Nitrite database;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    // One instance per type: each instance's lock is what keeps its version writes unique.
    private final Map<ConfigType, NitriteVersionDocumentStore> stores = new ConcurrentHashMap<>();
    private final Lock defaultsLock = new ReentrantLock();

    @Inject
    public NitriteConfigStore(@StandaloneQualifier Nitrite database, NitriteNamespaceStore namespaceStore,
                              NitriteCounterStore counterStore) {
        this.database = database;
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
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
        NitriteVersionDocumentStore store = store(type);
        store.createHeader(namespace, id, request.getName(), request.getDescription());
        store.createFirstVersion(namespace, id, request.getConfigJson());
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
        String content = requireConfig(namespace, type, id).getVersion(namespace, id, version);
        if (content == null) {
            throw new ConfigVersionNotFoundException();
        }
        return content;
    }

    @Override
    public void createConfigForVersion(CreateConfigRequest request, String namespace, ConfigType type, int id,
                                       String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionExistsException {
        NitriteVersionDocumentStore store = requireConfig(namespace, type, id);
        if (!store.createVersion(namespace, id, version, request.getConfigJson())) {
            throw new ConfigVersionExistsException();
        }
        store.updatePresentHeaderDetails(namespace, id, request.getName(), request.getDescription());
    }

    @Override
    public Optional<ConfigDefault> getDefault(String namespace, ConfigType type) {
        Document stored = defaults().find(defaultFilter(namespace, type)).firstOrNull();
        return Optional.ofNullable(stored).map(d -> new ConfigDefault(type.getName(), namespace,
                d.get(ID_FIELD, Integer.class), d.get(VERSION_FIELD, String.class)));
    }

    @Override
    public ConfigDefault setDefault(String namespace, ConfigType type, int id, String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionNotFoundException {
        if (requireConfig(namespace, type, id).getVersion(namespace, id, version) == null) {
            throw new ConfigVersionNotFoundException();
        }
        String canonical = CanonicalVersion.of(version);
        defaultsLock.lock();
        try {
            defaults().remove(defaultFilter(namespace, type));
            defaults().insert(Document.createDocument(NAMESPACE_FIELD, namespace)
                    .put(TYPE_FIELD, type.getName())
                    .put(ID_FIELD, id)
                    .put(VERSION_FIELD, canonical));
        } finally {
            defaultsLock.unlock();
        }
        return new ConfigDefault(type.getName(), namespace, id, canonical);
    }

    @Override
    public boolean deleteDefault(String namespace, ConfigType type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        defaultsLock.lock();
        try {
            return defaults().remove(defaultFilter(namespace, type)).getAffectedCount() > 0;
        } finally {
            defaultsLock.unlock();
        }
    }

    @Override
    public boolean hasContent(String namespace) {
        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        return database.getCollection(HEADER_COLLECTION).find(filter).firstOrNull() != null
                || defaults().find(filter).firstOrNull() != null;
    }

    private NitriteVersionDocumentStore store(ConfigType type) {
        return stores.computeIfAbsent(type, t -> new NitriteVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION), database.getCollection(VERSION_COLLECTION), ID_FIELD,
                "Config", TYPE_FIELD, t.getName()));
    }

    private NitriteVersionDocumentStore requireConfig(String namespace, ConfigType type, int id)
            throws NamespaceNotFoundException, ConfigNotFoundException {
        namespaceStore.requireNamespace(namespace);
        NitriteVersionDocumentStore store = store(type);
        if (!store.headerExists(namespace, id)) {
            throw new ConfigNotFoundException();
        }
        return store;
    }

    private NitriteCollection defaults() {
        return database.getCollection(DEFAULT_COLLECTION);
    }

    private static Filter defaultFilter(String namespace, ConfigType type) {
        return Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(TYPE_FIELD).eq(type.getName()));
    }
}
