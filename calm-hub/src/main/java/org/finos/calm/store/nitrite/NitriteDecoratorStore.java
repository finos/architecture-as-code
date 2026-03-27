package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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

    @Override
    public List<Decorator> getDecoratorValuesForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
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

        List<Decorator> decoratorValues = filterDecoratorsToValues(decorators, target, type);

        LOG.debug("Retrieved {} decorator values for namespace '{}' with filters (target: {}, type: {})",
                decoratorValues.size(), namespace, target, type);
        return decoratorValues;
    }

    @Override
    public Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException {
        validateNamespace(namespace);

        Document namespaceDoc = fetchNamespaceDocument(namespace);
        if (namespaceDoc == null) {
            return Optional.empty();
        }

        List<Document> decorators = extractDecorators(namespaceDoc, namespace);
        if (decorators.isEmpty()) {
            return Optional.empty();
        }

        return decorators.stream()
                .filter(decoratorDoc -> Integer.valueOf(id).equals(decoratorDoc.get(DECORATOR_ID_FIELD, Integer.class)))
                .map(decoratorDoc -> decoratorDoc.get("decorator", Document.class))
                .filter(Objects::nonNull)
                .map(doc -> new Decorator.DecoratorBuilder()
                        .setSchema(doc.get("$schema", String.class))
                        .setUniqueId(doc.get("unique-id", String.class))
                        .setType(doc.get("type", String.class))
                        .setTarget((List<String>) doc.get("target"))
                        .setTargetType((List<String>) doc.get("target-type"))
                        .setAppliesTo((List<String>) doc.get("applies-to"))
                        .setData(doc.get("data"))
                        .build())
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

    private Stream<Document> streamWithValidId(List<Document> decorators) {
        return decorators.stream()
                .filter(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class) != null);
    }

    private List<Integer> filterDecorators(List<Document> decorators, String target, String type) {
        return streamWithValidId(decorators)
                .filter(doc -> {
                    Document decorator = doc.get("decorator", Document.class);
                    return decorator == null || matchesFilters(decorator, target, type);
                })
                .map(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class))
                .collect(Collectors.toList());
    }

    private List<Decorator> filterDecoratorsToValues(List<Document> decorators, String target, String type) {
        return streamWithValidId(decorators)
                .map(doc -> doc.get("decorator", Document.class))
                .filter(Objects::nonNull)
                .filter(decorator -> matchesFilters(decorator, target, type))
                .map(decorator -> new Decorator.DecoratorBuilder()
                        .setSchema(decorator.get("$schema", String.class))
                        .setUniqueId(decorator.get("unique-id", String.class))
                        .setType(decorator.get("type", String.class))
                        .setTarget((List<String>) decorator.get("target"))
                        .setTargetType((List<String>) decorator.get("target-type"))
                        .setAppliesTo((List<String>) decorator.get("applies-to"))
                        .setData(decorator.get("data"))
                        .build())
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
