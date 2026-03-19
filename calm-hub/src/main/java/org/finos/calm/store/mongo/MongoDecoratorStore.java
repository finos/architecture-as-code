package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.Document;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * MongoDB implementation of DecoratorStore.
 */
@ApplicationScoped
@Typed(MongoDecoratorStore.class)
public class MongoDecoratorStore implements DecoratorStore {

    private static final Logger LOG = LoggerFactory.getLogger(MongoDecoratorStore.class);
    private static final String DECORATOR_ID_FIELD = "decoratorId";
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

    @Override
    public List<Decorator> getDecoratorValuesForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
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

        List<Decorator> decoratorValues = filterDecoratorsToValues(decorators, target, type);

        LOG.debug("Retrieved {} decorator values for namespace '{}' with filters (target: {}, type: {})",
                decoratorValues.size(), namespace, target, type);
        return decoratorValues;
    }

    @Override
    public Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException {
        validateNamespace(namespace);

        Document namespaceDocument = fetchNamespaceDocument(namespace);
        if (namespaceDocument == null || namespaceDocument.isEmpty()) {
            return Optional.empty();
        }

        List<Document> decorators = extractDecorators(namespaceDocument, namespace);
        if (decorators.isEmpty()) {
            return Optional.empty();
        }

        return decorators.stream()
                .filter(decoratorDoc -> Integer.valueOf(id).equals(decoratorDoc.getInteger("decoratorId")))
                .map(decoratorDoc -> decoratorDoc.get("decorator", Document.class))
                .filter(Objects::nonNull)
                .map(Decorator::fromDocument)
                .findFirst();
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

    private Stream<Document> streamWithValidId(List<Document> decorators) {
        return decorators.stream()
                .filter(doc -> doc.getInteger(DECORATOR_ID_FIELD) != null);
    }

    private List<Integer> filterDecorators(List<Document> decorators, String target, String type) {
        return streamWithValidId(decorators)
                .filter(doc -> {
                    Document decorator = doc.get("decorator", Document.class);
                    return decorator == null || matchesFilters(decorator, target, type);
                })
                .map(doc -> doc.getInteger(DECORATOR_ID_FIELD))
                .collect(Collectors.toList());
    }

    private List<Decorator> filterDecoratorsToValues(List<Document> decorators, String target, String type) {
        return streamWithValidId(decorators)
                .map(doc -> doc.get("decorator", Document.class))
                .filter(Objects::nonNull)
                .filter(decorator -> matchesFilters(decorator, target, type))
                .map(Decorator::fromDocument)
                .collect(Collectors.toList());
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
        if (target == null || target.isBlank()) {
            return true;
        }
        
        List<String> targets = decorator.getList("target", String.class);
        return targets != null && targets.contains(target);
    }
}
