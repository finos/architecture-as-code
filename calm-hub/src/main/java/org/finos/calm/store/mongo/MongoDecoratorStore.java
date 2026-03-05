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
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        validateNamespace(namespace);
        
        Document namespaceDocument = fetchNamespaceDocument(namespace);
        if (namespaceDocument == null || namespaceDocument.isEmpty()) {
            LOG.debug("No decorators found for namespace '{}'", namespace);
            return List.of();
        }

        List<Document> decorators = extractDecorators(namespaceDocument, namespace);
        if (decorators.isEmpty()) {
            return List.of();
        }

        List<Integer> decoratorIds = filterDecorators(decorators, target, type);

        LOG.debug("Retrieved {} decorators for namespace '{}' with filters (target: {}, type: {})", 
                decoratorIds.size(), namespace, target, type);
        return decoratorIds;
    }

    /**
     * Validates that the namespace exists, throwing an exception if it doesn't
     */
    private void validateNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving decorators", namespace);
            throw new NamespaceNotFoundException();
        }
    }

    /**
     * Fetches the namespace document from MongoDB
     */
    private Document fetchNamespaceDocument(String namespace) {
        return decoratorCollection.find(Filters.eq("namespace", namespace)).first();
    }

    /**
     * Extracts the list of decorators from the namespace document
     */
    private List<Document> extractDecorators(Document namespaceDocument, String namespace) {
        List<Document> decorators = namespaceDocument.getList("decorators", Document.class);
        if (decorators == null || decorators.isEmpty()) {
            LOG.debug("Decorators list is empty for namespace '{}'", namespace);
            return List.of();
        }
        return decorators;
    }

    /**
     * Filters decorators based on target and type criteria
     */
    private List<Integer> filterDecorators(List<Document> decorators, String target, String type) {
        List<Integer> decoratorIds = new ArrayList<>();
        
        for (Document decoratorDoc : decorators) {
            Integer decoratorId = decoratorDoc.getInteger("decoratorId");
            if (decoratorId == null) {
                continue;
            }

            Document decorator = decoratorDoc.get("decorator", Document.class);
            if (decorator != null && matchesFilters(decorator, target, type)) {
                decoratorIds.add(decoratorId);
            } else if (decorator == null) {
                decoratorIds.add(decoratorId);
            }
        }
        
        return decoratorIds;
    }

    /**
     * Checks if a decorator matches the provided filters
     */
    private boolean matchesFilters(Document decorator, String target, String type) {
        return matchesTypeFilter(decorator, type) && matchesTargetFilter(decorator, target);
    }

    /**
     * Checks if the decorator matches the type filter (if provided)
     */
    private boolean matchesTypeFilter(Document decorator, String type) {
        if (type == null || type.isEmpty()) {
            return true;
        }
        
        String decoratorType = decorator.getString("type");
        return decoratorType != null && decoratorType.equals(type);
    }

    /**
     * Checks if the decorator matches the target filter (if provided)
     */
    private boolean matchesTargetFilter(Document decorator, String target) {
        if (target == null || target.isEmpty()) {
            return true;
        }
        
        @SuppressWarnings("unchecked")
        List<String> targets = (List<String>) decorator.get("target");
        return targets != null && targets.contains(target);
    }
}
