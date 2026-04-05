package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.NamespaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB-backed implementation of {@link NamespaceStore}, used in standalone mode.
 *
 * <h2>Concurrency strategy — ReentrantLock</h2>
 * Unlike the MongoDB implementation ({@link org.finos.calm.store.mongo.MongoNamespaceStore}),
 * NitriteDB does not support unique index constraints. Instead, this class uses a
 * {@link ReentrantLock} to serialize write operations: the lock is acquired before
 * checking for an existing namespace and held through the insert, ensuring that no
 * concurrent thread can insert a duplicate between the check and the insert.
 *
 * <h2>Limitation — single JVM only</h2>
 * Because {@link ReentrantLock} is a JVM-level construct, this strategy only works
 * within a single application instance. If multiple instances share the same Nitrite
 * database file, concurrent writes from different JVMs would not be protected.
 * This is acceptable because standalone/Nitrite mode is designed for single-instance
 * deployments; horizontal scaling requires MongoDB mode.
 *
 * @see org.finos.calm.store.mongo.MongoNamespaceStore MongoNamespaceStore for the
 *      contrasting database-enforced uniqueness approach
 */
@ApplicationScoped
@Typed(NitriteNamespaceStore.class)
public class NitriteNamespaceStore implements NamespaceStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteNamespaceStore.class);
    private static final String COLLECTION_NAME = "namespaces";
    private static final String NAME_FIELD = "name";
    private static final String DESCRIPTION_FIELD = "description";

    private final NitriteCollection namespaceCollection;
    private final Lock lock = new ReentrantLock();

    @Inject
    public NitriteNamespaceStore(@StandaloneQualifier Nitrite db) {
        this.namespaceCollection = db.getCollection(COLLECTION_NAME);
        LOG.info("NitriteNamespaceStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<NamespaceInfo> getNamespaces() {
        List<NamespaceInfo> namespaces = new ArrayList<>();
        for (Document doc : namespaceCollection.find()) {
            namespaces.add(new NamespaceInfo(doc.get(NAME_FIELD, String.class), doc.get(DESCRIPTION_FIELD, String.class)));
        }
        LOG.debug("Retrieved {} namespaces from NitriteDB", namespaces.size());
        return namespaces;
    }

    @Override
    public boolean namespaceExists(String namespaceName) {
        Filter filter = where(NAME_FIELD).eq(namespaceName);
        Document doc = namespaceCollection.find(filter).firstOrNull();
        boolean exists = doc != null;
        LOG.debug("Namespace '{}' exists: {}", namespaceName, exists);
        return exists;
    }

    /**
     * Creates a namespace, guarded by a {@link ReentrantLock} to prevent concurrent
     * duplicate creation. The lock is held across the existence check and the insert
     * to eliminate the check-then-act race condition.
     */
    @Override
    public void createNamespace(String name, String description) throws NamespaceAlreadyExistsException {
        lock.lock();
        try {
            if (namespaceExists(name)) {
                throw new NamespaceAlreadyExistsException("Namespace already exists: " + name);
            }
            Document namespaceDoc = Document.createDocument()
                    .put(NAME_FIELD, name)
                    .put(DESCRIPTION_FIELD, description);
            namespaceCollection.insert(namespaceDoc);
            LOG.info("Created namespace: {}", name);
        } finally {
            lock.unlock();
        }
    }
}
