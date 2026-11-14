package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.exceptions.InvalidIdException;
import org.dizitart.no2.exceptions.InvalidOperationException;
import org.dizitart.no2.exceptions.ValidationException;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.util.DecoratorHistoryChain;
import org.finos.calm.store.util.DecoratorJson;
import org.finos.calm.store.util.DecoratorTimestamps;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.dizitart.no2.filters.FluentFilter.where;
import static org.finos.calm.store.util.DecoratorTimestamps.CREATION_DATE_TIME_FIELD;
import static org.finos.calm.store.util.DecoratorTimestamps.SUPERSEDED_DATE_TIME_FIELD;
import static org.finos.calm.store.util.DecoratorTimestamps.UPDATE_DATE_TIME_FIELD;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * NitriteDB implementation of DecoratorStore.
 * This implementation is used when the application is running in standalone mode.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteDecoratorStore.class)
public class NitriteDecoratorStore implements DecoratorStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteDecoratorStore.class);
    private static final String COLLECTION_NAME = "decorators";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String DECORATORS_FIELD = "decorators";
    private static final String DECORATOR_ID_FIELD = "decoratorId";
    // Hub-owned history links and times, stored beside the decorator rather than in it.
    private static final String SUPERSEDES_FIELD = "supersedes";
    private static final String SUPERSEDED_BY_FIELD = "supersededBy";

    private final NitriteCollection decoratorCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final Lock lock = new ReentrantLock();

    @Inject
    public NitriteDecoratorStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.decoratorCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        LOG.info("NitriteDecoratorStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

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
        namespaceStore.requireNamespace(namespace);

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
        namespaceStore.requireNamespace(namespace);

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
                .filter(decoratorDoc -> decoratorDoc.get("decorator", Document.class) != null)
                .map(this::entryToDecorator)
                .findFirst();
    }

    @Override
    public int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        Document decoratorDoc = parseJsonToNitriteDocument(decoratorJson);
        lock.lock();
        try {
            int id = counterStore.getNextDecoratorSequenceValue();
            String now = DecoratorTimestamps.now();
            Document decoratorEntry = Document.createDocument(DECORATOR_ID_FIELD, id)
                    .put("decorator", decoratorDoc)
                    .put(CREATION_DATE_TIME_FIELD, now)
                    .put(UPDATE_DATE_TIME_FIELD, now);

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
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void updateDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);

        lock.lock();
        try {
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

            Document entry = decorators.stream()
                    .filter(decoratorEntry -> Integer.valueOf(id).equals(decoratorEntry.get(DECORATOR_ID_FIELD, Integer.class)))
                    .findFirst()
                    .orElseThrow(DecoratorNotFoundException::new);
            if (entry.get(SUPERSEDED_BY_FIELD) != null) {
                throw new DecoratorSupersededException();
            }
            entry.put("decorator", updatedDoc);
            entry.put(UPDATE_DATE_TIME_FIELD, DecoratorTimestamps.now());

            namespaceDoc.put(DECORATORS_FIELD, decorators);
            decoratorCollection.update(namespaceDoc);
            LOG.debug("Updated decorator with ID {} in namespace '{}'", id, namespace);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public int supersedeDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);

        Document decoratorDoc = parseJsonToNitriteDocument(decoratorJson);
        lock.lock();
        try {
            Document namespaceDoc = fetchNamespaceDocument(namespace);
            if (namespaceDoc == null) {
                throw new DecoratorNotFoundException();
            }

            List<Document> decorators = new ArrayList<>(extractDecorators(namespaceDoc, namespace));
            Document superseded = decorators.stream()
                    .filter(decoratorEntry -> Integer.valueOf(id).equals(decoratorEntry.get(DECORATOR_ID_FIELD, Integer.class)))
                    .findFirst()
                    .orElseThrow(DecoratorNotFoundException::new);
            if (superseded.get(SUPERSEDED_BY_FIELD) != null) {
                throw new DecoratorSupersededException();
            }

            int newId = counterStore.getNextDecoratorSequenceValue();
            String now = DecoratorTimestamps.now();
            superseded.put(SUPERSEDED_BY_FIELD, newId);
            superseded.put(SUPERSEDED_DATE_TIME_FIELD, now);
            decorators.add(Document.createDocument(DECORATOR_ID_FIELD, newId)
                    .put("decorator", decoratorDoc)
                    .put(SUPERSEDES_FIELD, id)
                    .put(CREATION_DATE_TIME_FIELD, now)
                    .put(UPDATE_DATE_TIME_FIELD, now));

            namespaceDoc.put(DECORATORS_FIELD, decorators);
            decoratorCollection.update(namespaceDoc);
            LOG.debug("Decorator with ID {} supersedes decorator {} in namespace '{}'", newId, id, namespace);
            return newId;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<DecoratorHistoryEntry> getDecoratorHistory(String namespace, int id)
            throws NamespaceNotFoundException, DecoratorNotFoundException {
        namespaceStore.requireNamespace(namespace);

        Document namespaceDoc = fetchNamespaceDocument(namespace);
        List<DecoratorHistoryEntry> history = namespaceDoc == null
                ? List.of()
                : DecoratorHistoryChain.of(historyEntries(namespaceDoc, namespace), id);
        if (history.isEmpty()) {
            throw new DecoratorNotFoundException();
        }
        return history;
    }

    @Override
    public void deleteCurrentDecoratorHistory(String namespace, int currentId)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);

        lock.lock();
        try {
            Document namespaceDoc = requireNamespaceDocument(namespace);
            List<Document> decorators = decoratorEntries(namespaceDoc);
            Document entry = decorators.stream()
                    .filter(candidate -> Integer.valueOf(currentId).equals(candidate.get(DECORATOR_ID_FIELD, Integer.class)))
                    .findFirst()
                    .orElseThrow(DecoratorNotFoundException::new);
            if (entry.get(SUPERSEDED_BY_FIELD) != null) {
                throw new DecoratorSupersededException();
            }
            Set<Integer> ids = DecoratorHistoryChain.of(historyEntries(namespaceDoc, namespace), currentId).stream()
                    .map(DecoratorHistoryEntry::getId)
                    .collect(Collectors.toSet());
            List<Document> remaining = new ArrayList<>(decorators);
            remaining.removeIf(decoratorEntry -> ids.contains(decoratorEntry.get(DECORATOR_ID_FIELD, Integer.class)));

            namespaceDoc.put(DECORATORS_FIELD, remaining);
            decoratorCollection.update(namespaceDoc);
            LOG.debug("Deleted decorator with ID {} and its history in namespace '{}'", currentId, namespace);
        } finally {
            lock.unlock();
        }
    }

    private Document requireNamespaceDocument(String namespace) throws DecoratorNotFoundException {
        Document namespaceDoc = fetchNamespaceDocument(namespace);
        if (namespaceDoc == null) {
            throw new DecoratorNotFoundException();
        }
        return namespaceDoc;
    }

    private static List<Document> decoratorEntries(Document namespaceDoc) throws DecoratorNotFoundException {
        List<Document> decorators = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class).getList(DECORATORS_FIELD);
        if (decorators == null) {
            throw new DecoratorNotFoundException();
        }
        return decorators;
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

    private List<DecoratorHistoryEntry> historyEntries(Document namespaceDoc, String namespace) {
        return extractDecorators(namespaceDoc, namespace).stream()
                .filter(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class) != null)
                .map(doc -> new DecoratorHistoryEntry(
                        doc.get(DECORATOR_ID_FIELD, Integer.class),
                        doc.get(SUPERSEDES_FIELD, Integer.class),
                        doc.get(SUPERSEDED_BY_FIELD, Integer.class),
                        doc.get(SUPERSEDED_DATE_TIME_FIELD, String.class),
                        entryToDecorator(doc)))
                .toList();
    }

    private Decorator entryToDecorator(Document entry) {
        Document decorator = entry.get("decorator", Document.class);
        return decorator == null ? null : documentToDecorator(decorator).withTimestamps(
                entry.get(CREATION_DATE_TIME_FIELD, String.class), entry.get(UPDATE_DATE_TIME_FIELD, String.class));
    }

    private Stream<Document> streamCurrent(List<Document> decorators) {
        return decorators.stream()
                .filter(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class) != null)
                .filter(doc -> doc.get(SUPERSEDED_BY_FIELD) == null);
    }

    private List<Integer> filterDecorators(List<Document> decorators, String target, String type) {
        return streamCurrent(decorators)
                .filter(doc -> {
                    Document decorator = doc.get("decorator", Document.class);
                    return decorator == null || matchesFilters(decorator, target, type);
                })
                .map(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class))
                .collect(Collectors.toList());
    }

    private List<Decorator> filterDecoratorsToValues(List<Document> decorators, String target, String type) {
        return streamCurrent(decorators)
                .filter(doc -> {
                    Document decorator = doc.get("decorator", Document.class);
                    return decorator != null && matchesFilters(decorator, target, type);
                })
                .map(this::entryToDecorator)
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
        
        return type.equals(decorator.get("type"));
    }

    // Nitrite only deserializes its own and JDK types, so no org.bson value may reach the store.
    Document parseJsonToNitriteDocument(String json) {
        return toNitriteDocument(DecoratorJson.parseObject(json));
    }

    // Document.put refuses an _id that is not a long, an empty key and an empty part of a dotted key.
    private static Document toNitriteDocument(Map<?, ?> map) {
        Document doc = Document.createDocument();
        map.forEach((key, value) -> {
            Object nitriteValue = toNitriteValue(value);
            try {
                doc.put(key.toString(), nitriteValue);
            } catch (InvalidIdException e) {
                throw DecoratorKeyRefusedException.idWithAnotherValue();
            } catch (InvalidOperationException | ValidationException e) {
                throw DecoratorKeyRefusedException.emptyKeyPart();
            }
        });
        return doc;
    }

    private static Object toNitriteValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            return toNitriteDocument(map);
        }
        if (value instanceof List<?> list) {
            List<Object> values = new ArrayList<>(list.size());
            list.forEach(item -> values.add(toNitriteValue(item)));
            return values;
        }
        return value;
    }

    Decorator documentToDecorator(Document doc) {
        return new Decorator.DecoratorBuilder()
                .setSchema(Decorator.stringOrNull(doc.get("$schema")))
                .setUniqueId(Decorator.stringOrNull(doc.get("unique-id")))
                .setType(Decorator.stringOrNull(doc.get("type")))
                .setTarget(Decorator.stringListOrNull(doc.get("target")))
                .setTargetType(Decorator.stringListOrNull(doc.get("target-type")))
                .setAppliesTo(Decorator.stringListOrNull(doc.get("applies-to")))
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
