package org.finos.calm.store.mongo;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.NamespaceStore;

import java.util.ArrayList;
import java.util.List;

/**
 * MongoDB-backed implementation of {@link NamespaceStore}.
 *
 * <h2>Concurrency strategy</h2>
 * A unique index on {@code namespaces.name} (created by {@link MongoIndexInitializer}) prevents
 * duplicate namespace names at the database level. When two concurrent requests try to create the
 * same namespace, the first {@code insertOne} succeeds and the second throws a
 * {@link MongoWriteException} with error category {@link ErrorCategory#DUPLICATE_KEY}.
 * This class catches that exception and translates it into a
 * {@link NamespaceAlreadyExistsException}, providing a clean domain-level error to callers.
 *
 * <p>This "optimistic insert" pattern avoids the need for application-level locking and is
 * safe across multiple application instances (horizontal scaling), because the uniqueness
 * constraint is enforced by MongoDB itself.
 *
 * @see MongoIndexInitializer
 * @see org.finos.calm.store.nitrite.NitriteNamespaceStore NitriteNamespaceStore for the
 *      contrasting ReentrantLock-based approach used in standalone mode
 */
@ApplicationScoped
@Typed(MongoNamespaceStore.class)
public class MongoNamespaceStore implements NamespaceStore {

    private final MongoCollection<Document> namespaceCollection;

    public MongoNamespaceStore(MongoDatabase database) {
        this.namespaceCollection = database.getCollection("namespaces");
    }

    @Override
    public List<NamespaceInfo> getNamespaces() {
        List<NamespaceInfo> namespaces = new ArrayList<>();
        for (Document doc : namespaceCollection.find()) {
            namespaces.add(new NamespaceInfo(doc.getString("name"), doc.getString("description")));
        }
        return namespaces;
    }

    @Override
    public boolean namespaceExists(String namespaceName) {
        Document query = new Document("name", namespaceName);
        return namespaceCollection.find(query).first() != null;
    }

    /**
     * Inserts a new namespace document. If a concurrent request already inserted a namespace
     * with the same name, MongoDB's unique index causes a {@code DUPLICATE_KEY} error which
     * is caught and re-thrown as {@link NamespaceAlreadyExistsException}.
     * Any other {@link MongoWriteException} is propagated unchanged.
     */
    @Override
    public void createNamespace(String name, String description) throws NamespaceAlreadyExistsException {
        try {
            Document namespaceDoc = new Document("name", name)
                    .append("description", description);
            namespaceCollection.insertOne(namespaceDoc);
        } catch (MongoWriteException e) {
            if (ErrorCategory.fromErrorCode(e.getError().getCode()) == ErrorCategory.DUPLICATE_KEY) {
                throw new NamespaceAlreadyExistsException("Namespace already exists: " + name);
            }
            throw e;
        }
    }
}
