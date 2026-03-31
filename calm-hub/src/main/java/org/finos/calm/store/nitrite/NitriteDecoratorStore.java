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
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
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
    private final NitriteCounterStore counterStore;

    @Inject
    public NitriteDecoratorStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.decoratorCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
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
    public Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException, DecoratorNotFoundException {
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
                .map(this::documentToDecorator)
                .findFirst();
    }

    @Override
    public int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException {
        validateNamespace(namespace);

        Document decoratorDoc = parseJsonToNitriteDocument(decoratorJson);
        int id = counterStore.getNextDecoratorSequenceValue();
        Document decoratorEntry = Document.createDocument(DECORATOR_ID_FIELD, id)
                .put("decorator", decoratorDoc);

        Document namespaceDoc = fetchNamespaceDocument(namespace);
        if (namespaceDoc == null) {
            Document newNamespaceDoc = Document.createDocument(NAMESPACE_FIELD, namespace)
                    .put(DECORATORS_FIELD, new ArrayList<>(List.of(decoratorEntry)));
            decoratorCollection.insert(newNamespaceDoc);
        } else {
            TypeSafeNitriteDocument<Document> typeSafeDoc = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class);
            List<Document> decorators = typeSafeDoc.getList(DECORATORS_FIELD);
            List<Document> mutableDecorators = decorators == null ? new ArrayList<>() : new ArrayList<>(decorators);
            mutableDecorators.add(decoratorEntry);
            namespaceDoc.put(DECORATORS_FIELD, mutableDecorators);
            decoratorCollection.update(namespaceDoc);
        }

        LOG.debug("Created decorator with ID {} in namespace '{}'", id, namespace);
        return id;
    }

    @Override
    public void updateDecorator(String namespace, int id, String decoratorJson) throws NamespaceNotFoundException, DecoratorNotFoundException {
        validateNamespace(namespace);

        Document namespaceDoc = fetchNamespaceDocument(namespace);
        if (namespaceDoc == null) {
            throw new DecoratorNotFoundException();
        }

        TypeSafeNitriteDocument<Document> typeSafeDoc = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class);
        List<Document> decorators = typeSafeDoc.getList(DECORATORS_FIELD);
        if (decorators == null) {
            throw new DecoratorNotFoundException();
        }

        Document updatedDoc = parseJsonToNitriteDocument(decoratorJson);

        decorators.stream()
                .filter(decoratorEntry -> Integer.valueOf(id).equals(decoratorEntry.get(DECORATOR_ID_FIELD, Integer.class)))
                .findFirst()
                .orElseThrow(DecoratorNotFoundException::new)
                .put("decorator", updatedDoc);

        namespaceDoc.put(DECORATORS_FIELD, decorators);
        decoratorCollection.update(namespaceDoc);
        LOG.debug("Updated decorator with ID {} in namespace '{}'", id, namespace);
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
                .map(this::documentToDecorator)
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

    Document parseJsonToNitriteDocument(String json) {
        return org.bson.Document.parse(json).entrySet().stream()
                .reduce(Document.createDocument(),
                        (doc, entry) -> doc.put(entry.getKey(), entry.getValue()),
                        (d1, d2) -> d1);
    }

    Decorator documentToDecorator(Document doc) {
        return new Decorator.DecoratorBuilder()
                .setSchema(doc.get("$schema", String.class))
                .setUniqueId(doc.get("unique-id", String.class))
                .setType(doc.get("type", String.class))
                .setTarget((List<String>) doc.get("target"))
                .setTargetType((List<String>) doc.get("target-type"))
                .setAppliesTo((List<String>) doc.get("applies-to"))
                .setData(doc.get("data"))
                .build();
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
