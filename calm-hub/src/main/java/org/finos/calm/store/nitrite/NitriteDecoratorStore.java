package org.finos.calm.store.nitrite;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Stream;

import static org.dizitart.no2.filters.FluentFilter.where;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * NitriteDB implementation of DecoratorStore, used in standalone mode.
 *
 * <p>One document per decorator, the same shape as {@code MongoDecoratorStore}. See
 * {@code calm-hub/decisions/0019-decorator-storage-one-document-per-decorator.md}. Nitrite
 * has no indexes here, so the namespace and type filters run in Nitrite and the target
 * filter runs in memory.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteDecoratorStore.class)
public class NitriteDecoratorStore implements DecoratorStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteDecoratorStore.class);
    public static final String COLLECTION_NAME = "decorators";
    public static final String NAMESPACE_FIELD = "namespace";
    public static final String DECORATOR_ID_FIELD = "decoratorId";
    public static final String TYPE_FIELD = "type";
    public static final String TARGET_FIELD = "target";
    public static final String DECORATOR_FIELD = "decorator";

    private final NitriteCollection decoratorCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final Lock lock = new ReentrantLock();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Inject
    public NitriteDecoratorStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.decoratorCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        LOG.info("NitriteDecoratorStore initialized with collection: {}", COLLECTION_NAME);
    }

    /** The stored form of one decorator. {@code type} and {@code target} are copied to the top level for filtering. */
    public static Document toStoredDocument(String namespace, int decoratorId, Document decorator) {
        return Document.createDocument(NAMESPACE_FIELD, namespace)
                .put(DECORATOR_ID_FIELD, decoratorId)
                .put(TYPE_FIELD, decorator.get(TYPE_FIELD))
                .put(TARGET_FIELD, decorator.get(TARGET_FIELD))
                .put(DECORATOR_FIELD, decorator);
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        List<Integer> ids = matching(namespace, target, type)
                .map(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class))
                .toList();
        LOG.debug("Retrieved {} decorators for namespace '{}' with filters (target: {}, type: {})",
                ids.size(), namespace, target, type);
        return ids;
    }

    @Override
    public List<Decorator> getDecoratorValuesForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        List<Decorator> values = matching(namespace, target, type)
                .map(doc -> doc.get(DECORATOR_FIELD, Document.class))
                .filter(Objects::nonNull)
                .map(this::documentToDecorator)
                .toList();
        LOG.debug("Retrieved {} decorator values for namespace '{}' with filters (target: {}, type: {})",
                values.size(), namespace, target, type);
        return values;
    }

    @Override
    public Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return Optional.ofNullable(decoratorCollection.find(byId(namespace, id)).firstOrNull())
                .map(doc -> doc.get(DECORATOR_FIELD, Document.class))
                .map(this::documentToDecorator);
    }

    @Override
    public int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        Document decorator = parseJsonToNitriteDocument(decoratorJson);
        lock.lock();
        try {
            int id = counterStore.getNextDecoratorSequenceValue();
            decoratorCollection.insert(toStoredDocument(namespace, id, decorator));
            LOG.debug("Created decorator with ID {} in namespace '{}'", id, namespace);
            return id;
        } finally {
            lock.unlock();
        }
    }

    // Nitrite's update merges nested documents, which would keep fields the new decorator
    // drops, so an update replaces the stored document instead.
    @Override
    public void updateDecorator(String namespace, int id, String decoratorJson) throws NamespaceNotFoundException, DecoratorNotFoundException {
        namespaceStore.requireNamespace(namespace);
        Document decorator = parseJsonToNitriteDocument(decoratorJson);
        lock.lock();
        try {
            if (decoratorCollection.remove(byId(namespace, id)).getAffectedCount() == 0) {
                throw new DecoratorNotFoundException();
            }
            decoratorCollection.insert(toStoredDocument(namespace, id, decorator));
            LOG.debug("Updated decorator with ID {} in namespace '{}'", id, namespace);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void deleteDecorator(String namespace, int id) throws NamespaceNotFoundException, DecoratorNotFoundException {
        namespaceStore.requireNamespace(namespace);
        lock.lock();
        try {
            if (decoratorCollection.remove(byId(namespace, id)).getAffectedCount() == 0) {
                throw new DecoratorNotFoundException();
            }
            LOG.debug("Deleted decorator with ID {} in namespace '{}'", id, namespace);
        } finally {
            lock.unlock();
        }
    }

    private static Filter byId(String namespace, int id) {
        return Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(DECORATOR_ID_FIELD).eq(id));
    }

    private Stream<Document> matching(String namespace, String target, String type) {
        Filter filter = type == null || type.isEmpty()
                ? where(NAMESPACE_FIELD).eq(namespace)
                : Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(TYPE_FIELD).eq(type));
        List<Document> found = new ArrayList<>();
        decoratorCollection.find(filter).forEach(found::add);
        return found.stream()
                .filter(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class) != null)
                .filter(doc -> matchesTarget(doc, target))
                .sorted(Comparator.comparing(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class)));
    }

    private static boolean matchesTarget(Document doc, String target) {
        if (target == null || target.isBlank()) {
            return true;
        }
        return doc.get(TARGET_FIELD) instanceof List<?> targets && targets.contains(target);
    }

    // Nitrite only deserializes its own and JDK types, so no org.bson value may reach the store.
    // Jackson gives only JDK types and keeps extended-JSON keys such as $numberDecimal as plain data.
    Document parseJsonToNitriteDocument(String json) {
        Map<?, ?> map;
        try {
            map = objectMapper.readValue(json, Map.class);
        } catch (JsonProcessingException e) {
            throw new JsonParseException(e.getOriginalMessage());
        }
        if (map == null) {
            throw new JsonParseException("Decorator JSON must be an object");
        }
        return toNitriteDocument(map);
    }

    private static Document toNitriteDocument(Map<?, ?> map) {
        Document doc = Document.createDocument();
        map.forEach((key, value) -> doc.put(key.toString(), toNitriteValue(value)));
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
                .setSchema(doc.get("$schema", String.class))
                .setUniqueId(doc.get("unique-id", String.class))
                .setType(doc.get("type", String.class))
                .setTarget((List<String>) doc.get("target"))
                .setTargetType((List<String>) doc.get("target-type"))
                .setAppliesTo((List<String>) doc.get("applies-to"))
                .setData(doc.get("data"))
                .build();
    }
}
