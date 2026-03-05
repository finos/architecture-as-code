package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB implementation of DecoratorStore.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteDecoratorStore.class)
public class NitriteDecoratorStore implements DecoratorStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteDecoratorStore.class);
    private static final String COLLECTION_NAME = "decorators";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String DECORATORS_FIELD = "decorators";
    private static final String DECORATOR_ID_FIELD = "decoratorId";

    private final NitriteCollection decoratorCollection;
    private final NitriteNamespaceStore namespaceStore;

    @Inject
    public NitriteDecoratorStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore) {
        this.decoratorCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        LOG.info("NitriteDecoratorStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        validateNamespace(namespace);
        
        Document namespaceDoc = fetchNamespaceDocument(namespace);
        if (namespaceDoc == null) {
            LOG.debug("No decorators found for namespace '{}'", namespace);
            return List.of();
        }

        List<Document> decorators = extractDecorators(namespaceDoc, namespace);
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
     * Fetches the namespace document from NitriteDB
     */
    private Document fetchNamespaceDocument(String namespace) {
        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        return decoratorCollection.find(filter).firstOrNull();
    }

    /**
     * Extracts the list of decorators from the namespace document
     */
    private List<Document> extractDecorators(Document namespaceDoc, String namespace) {
        TypeSafeNitriteDocument<Document> typeSafeDoc = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class);
        List<Document> decorators = typeSafeDoc.getList(DECORATORS_FIELD);

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
            Integer decoratorId = decoratorDoc.get(DECORATOR_ID_FIELD, Integer.class);
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
        
        String decoratorType = decorator.get("type", String.class);
        return decoratorType != null && decoratorType.equals(type);
    }

    /**
     * Checks if the decorator matches the target filter (if provided)
     */
    private boolean matchesTargetFilter(Document decorator, String target) {
        if (target == null || target.isEmpty()) {
            return true;
        }
        
        Object targetObj = decorator.get("target");
        if (!(targetObj instanceof List)) {
            return false;
        }
        
        @SuppressWarnings("unchecked")
        List<String> targets = (List<String>) targetObj;
        return targets.contains(target);
    }
}
