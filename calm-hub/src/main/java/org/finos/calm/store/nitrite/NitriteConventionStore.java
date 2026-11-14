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
@Typed(NitriteConventionStore.class)
public class NitriteConventionStore implements ConventionStore {

    static final String HEADER_COLLECTION = "conventions";
    static final String VERSION_COLLECTION = "conventionVersions";
    static final String DEFAULT_COLLECTION = "conventionDefaults";
    static final String ID_FIELD = "conventionId";
    static final String TYPE_FIELD = "conventionType";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String VERSION_FIELD = "version";

    private final Nitrite database;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    // One instance per type: each instance's lock is what keeps its version writes unique.
    private final Map<ConventionType, NitriteVersionDocumentStore> stores = new ConcurrentHashMap<>();
    private final Lock defaultsLock = new ReentrantLock();

    @Inject
    public NitriteConventionStore(@StandaloneQualifier Nitrite database, NitriteNamespaceStore namespaceStore,
                              NitriteCounterStore counterStore) {
        this.database = database;
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
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
        NitriteVersionDocumentStore store = store(type);
        store.createHeader(namespace, id, request.getName(), request.getDescription());
        store.createFirstVersion(namespace, id, request.getConventionJson());
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
        String content = requireConvention(namespace, type, id).getVersion(namespace, id, version);
        if (content == null) {
            throw new ConventionVersionNotFoundException();
        }
        return content;
    }

    @Override
    public void createConventionForVersion(CreateConventionRequest request, String namespace, ConventionType type, int id,
                                       String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionExistsException {
        NitriteVersionDocumentStore store = requireConvention(namespace, type, id);
        if (!store.createVersion(namespace, id, version, request.getConventionJson())) {
            throw new ConventionVersionExistsException();
        }
        store.updatePresentHeaderDetails(namespace, id, request.getName(), request.getDescription());
    }

    @Override
    public Optional<ConventionDefault> getDefault(String namespace, ConventionType type) {
        Document stored = defaults().find(defaultFilter(namespace, type)).firstOrNull();
        return Optional.ofNullable(stored).map(d -> new ConventionDefault(type.getName(), namespace,
                d.get(ID_FIELD, Integer.class), d.get(VERSION_FIELD, String.class)));
    }

    @Override
    public ConventionDefault setDefault(String namespace, ConventionType type, int id, String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException {
        if (requireConvention(namespace, type, id).getVersion(namespace, id, version) == null) {
            throw new ConventionVersionNotFoundException();
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
        return new ConventionDefault(type.getName(), namespace, id, canonical);
    }

    @Override
    public boolean deleteDefault(String namespace, ConventionType type) throws NamespaceNotFoundException {
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

    private NitriteVersionDocumentStore store(ConventionType type) {
        return stores.computeIfAbsent(type, t -> new NitriteVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION), database.getCollection(VERSION_COLLECTION), ID_FIELD,
                "Convention", TYPE_FIELD, t.getName()));
    }

    private NitriteVersionDocumentStore requireConvention(String namespace, ConventionType type, int id)
            throws NamespaceNotFoundException, ConventionNotFoundException {
        namespaceStore.requireNamespace(namespace);
        NitriteVersionDocumentStore store = store(type);
        if (!store.headerExists(namespace, id)) {
            throw new ConventionNotFoundException();
        }
        return store;
    }

    private NitriteCollection defaults() {
        return database.getCollection(DEFAULT_COLLECTION);
    }

    private static Filter defaultFilter(String namespace, ConventionType type) {
        return Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(TYPE_FIELD).eq(type.getName()));
    }
}
