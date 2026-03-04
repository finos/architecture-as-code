package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.Document;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * MongoDB implementation of DecoratorStore.
 */
@ApplicationScoped
@Typed(MongoDecoratorStore.class)
public class MongoDecoratorStore implements DecoratorStore {

    private static final Logger LOG = LoggerFactory.getLogger(MongoDecoratorStore.class);
    private final MongoCollection<Document> decoratorCollection;
    private final MongoNamespaceStore namespaceStore;

    @Inject
    public MongoDecoratorStore(MongoDatabase database, MongoNamespaceStore namespaceStore) {
        this.decoratorCollection = database.getCollection("decorators");
        this.namespaceStore = namespaceStore;
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving decorators", namespace);
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = decoratorCollection.find(Filters.eq("namespace", namespace)).first();

        // Protects from an unpopulated mongo collection
        if (namespaceDocument == null || namespaceDocument.isEmpty()) {
            LOG.debug("No decorators found for namespace '{}'", namespace);
            return List.of();
        }

        List<Document> decorators = namespaceDocument.getList("decorators", Document.class);
        if (decorators == null || decorators.isEmpty()) {
            LOG.debug("Decorators list is empty for namespace '{}'", namespace);
            return List.of();
        }

        List<Integer> decoratorIds = new ArrayList<>();
        for (Document decorator : decorators) {
            Integer decoratorId = decorator.getInteger("decoratorId");
            if (decoratorId != null) {
                decoratorIds.add(decoratorId);
            }
        }

        LOG.debug("Retrieved {} decorators for namespace '{}'", decoratorIds.size(), namespace);
        return decoratorIds;
    }
}
