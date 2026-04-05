package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB-backed implementation of {@link DomainStore}, used in standalone mode.
 *
 * <h2>Concurrency strategy — ReentrantLock</h2>
 * Same approach as {@link NitriteNamespaceStore}: a {@link ReentrantLock} serializes
 * write operations to prevent duplicate domain creation. The lock is held across the
 * existence check and insert to eliminate the check-then-act race condition.
 * This is a single-JVM strategy; horizontal scaling requires MongoDB mode.
 *
 * @see org.finos.calm.store.mongo.MongoDomainStore MongoDomainStore for the
 *      contrasting database-enforced uniqueness approach
 */
@ApplicationScoped
@Typed(NitriteDomainStore.class)
public class NitriteDomainStore implements DomainStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteDomainStore.class);
    private static final String COLLECTION_NAME = "domains";
    private static final String NAME_FIELD = "name";
    
    private final NitriteCollection domainCollection;
    private final Lock lock = new ReentrantLock();

    @Inject
    public NitriteDomainStore(@StandaloneQualifier Nitrite db) {
        this.domainCollection = db.getCollection(COLLECTION_NAME);
        LOG.info("NitriteDomainStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<String> getDomains() {
        List<String> domains = new ArrayList<>();
        
        for (Document doc : domainCollection.find()) {
            domains.add(doc.get(NAME_FIELD, String.class));
        }
        
        return domains;
    }

    /**
     * Creates a domain, guarded by a {@link ReentrantLock} to prevent concurrent
     * duplicate creation. The lock is held across the existence check and insert.
     */
    @Override
    public Domain createDomain(String name) throws DomainAlreadyExistsException {
        lock.lock();
        try {
            if (domainExists(name)) {
                LOG.warn("Domain already exists: {}", name);
                throw new DomainAlreadyExistsException("Domain already exists: " + name);
            }

            Document domainDocument = Document.createDocument()
                    .put(NAME_FIELD, name);

            domainCollection.insert(domainDocument);
            LOG.info("Created domain: {}", name);

            return new Domain(name);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Checks if a domain with the given name already exists.
     *
     * @param name the domain name to check
     * @return true if the domain exists, false otherwise
     */
    private boolean domainExists(String name) {
        Filter filter = where(NAME_FIELD).eq(name);
        return domainCollection.find(filter).firstOrNull() != null;
    }
}
