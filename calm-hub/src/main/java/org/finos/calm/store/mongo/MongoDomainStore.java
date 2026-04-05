package org.finos.calm.store.mongo;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;

import java.util.ArrayList;
import java.util.List;

/**
 * MongoDB-backed implementation of {@link DomainStore}.
 *
 * <h2>Concurrency strategy</h2>
 * Identical to {@link MongoNamespaceStore}: a unique index on {@code domains.name}
 * (created by {@link MongoIndexInitializer}) enforces uniqueness at the database level.
 * Concurrent duplicate inserts are caught as {@link ErrorCategory#DUPLICATE_KEY} errors
 * and translated into {@link DomainAlreadyExistsException}.
 *
 * @see MongoIndexInitializer
 * @see org.finos.calm.store.nitrite.NitriteDomainStore NitriteDomainStore for the standalone
 *      ReentrantLock-based approach
 */
@ApplicationScoped
@Typed(MongoDomainStore.class)
public class MongoDomainStore implements DomainStore {

    private final MongoCollection<Document> domainsCollection;

    public MongoDomainStore(MongoDatabase database) {
        this.domainsCollection = database.getCollection("domains");
    }

    @Override
    public List<String> getDomains() {
        List<String> domains = new ArrayList<>();
        for (Document doc : domainsCollection.find()) {
            domains.add(doc.getString("name"));
        }
        return domains;
    }

    /**
     * Inserts a new domain document. Concurrent duplicate inserts are caught via
     * MongoDB's unique index and translated to {@link DomainAlreadyExistsException}.
     */
    @Override
    public Domain createDomain(String name) throws DomainAlreadyExistsException {
        try {
            Document domainDocument = new Document("name", name);
            domainsCollection.insertOne(domainDocument);
            return new Domain(name);
        } catch (MongoWriteException e) {
            if (ErrorCategory.fromErrorCode(e.getError().getCode()) == ErrorCategory.DUPLICATE_KEY) {
                throw new DomainAlreadyExistsException("Domain already exists: " + name);
            }
            throw e;
        }
    }
}
