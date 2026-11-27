package org.finos.calm.store.nitrite;

import io.quarkus.arc.lookup.LookupIfProperty;
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
import static org.finos.calm.store.util.DecoratorTimestamps.CREATION_DATE_TIME_FIELD;
import static org.finos.calm.store.util.DecoratorTimestamps.SUPERSEDED_DATE_TIME_FIELD;
import static org.finos.calm.store.util.DecoratorTimestamps.UPDATE_DATE_TIME_FIELD;

/**
 * NitriteDB implementation of DecoratorStore, used in standalone mode.
 *
 * <p>One document per decorator, the same shape as {@code MongoDecoratorStore}. See
 * {@code calm-hub/decisions/0020-decorator-storage-one-document-per-decorator.md}. Nitrite
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
    // Hub-owned history links and times, stored beside the decorator rather than in it.
    public static final String SUPERSEDES_FIELD = "supersedes";
    public static final String SUPERSEDED_BY_FIELD = "supersededBy";
    public static final List<String> HUB_FIELDS = List.of(SUPERSEDES_FIELD, SUPERSEDED_BY_FIELD,
            CREATION_DATE_TIME_FIELD, UPDATE_DATE_TIME_FIELD, SUPERSEDED_DATE_TIME_FIELD);

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

    /**
     * The stored form of one decorator. {@code type} and {@code target} are copied to the top
     * level for filtering, only with the types the filters match. The caller adds the Hub fields.
     */
    public static Document toStoredDocument(String namespace, int decoratorId, Document decorator) {
        Document stored = Document.createDocument(NAMESPACE_FIELD, namespace).put(DECORATOR_ID_FIELD, decoratorId);
        if (decorator.get(TYPE_FIELD) instanceof String type) {
            stored.put(TYPE_FIELD, type);
        }
        if (decorator.get(TARGET_FIELD) instanceof List<?> target) {
            stored.put(TARGET_FIELD, target);
        }
        return stored.put(DECORATOR_FIELD, decorator);
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
                .map(this::toDecorator)
                .filter(Objects::nonNull)
                .toList();
        LOG.debug("Retrieved {} decorator values for namespace '{}' with filters (target: {}, type: {})",
                values.size(), namespace, target, type);
        return values;
    }

    @Override
    public Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return Optional.ofNullable(find(namespace, id)).map(this::toDecorator);
    }

    @Override
    public int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        Document decorator = parseJsonToNitriteDocument(decoratorJson);
        lock.lock();
        try {
            int id = counterStore.getNextDecoratorSequenceValue();
            String now = DecoratorTimestamps.now();
            decoratorCollection.insert(toStoredDocument(namespace, id, decorator)
                    .put(CREATION_DATE_TIME_FIELD, now)
                    .put(UPDATE_DATE_TIME_FIELD, now));
            LOG.debug("Created decorator with ID {} in namespace '{}'", id, namespace);
            return id;
        } finally {
            lock.unlock();
        }
    }

    // Nitrite's update merges nested documents, which would keep fields the new decorator
    // drops, so an update replaces the stored document and keeps only its Hub fields.
    @Override
    public void updateDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);
        Document decorator = parseJsonToNitriteDocument(decoratorJson);
        lock.lock();
        try {
            Document existing = requireCurrent(namespace, id);
            Document replacement = toStoredDocument(namespace, id, decorator);
            HUB_FIELDS.stream()
                    .filter(field -> existing.get(field) != null)
                    .forEach(field -> replacement.put(field, existing.get(field)));
            replacement.put(UPDATE_DATE_TIME_FIELD, DecoratorTimestamps.now());
            decoratorCollection.remove(byId(namespace, id));
            decoratorCollection.insert(replacement);
            LOG.debug("Updated decorator with ID {} in namespace '{}'", id, namespace);
        } finally {
            lock.unlock();
        }
    }

    // As in MongoDecoratorStore, the successor goes first: a failure between the writes leaves both
    // decorators current, never a mark that points to nothing.
    @Override
    public int supersedeDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);
        Document decorator = parseJsonToNitriteDocument(decoratorJson);
        lock.lock();
        try {
            requireCurrent(namespace, id);
            int newId = counterStore.getNextDecoratorSequenceValue();
            String now = DecoratorTimestamps.now();
            decoratorCollection.insert(toStoredDocument(namespace, newId, decorator)
                    .put(SUPERSEDES_FIELD, id)
                    .put(CREATION_DATE_TIME_FIELD, now)
                    .put(UPDATE_DATE_TIME_FIELD, now));
            decoratorCollection.update(byId(namespace, id), Document.createDocument(SUPERSEDED_BY_FIELD, newId)
                    .put(SUPERSEDED_DATE_TIME_FIELD, now));
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
        List<DecoratorHistoryEntry> history = DecoratorHistoryChain.of(historyEntries(namespace), id);
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
            requireCurrent(namespace, currentId);
            List<Integer> ids = DecoratorHistoryChain.of(historyEntries(namespace), currentId).stream()
                    .map(DecoratorHistoryEntry::getId)
                    .toList();
            decoratorCollection.remove(Filter.and(where(NAMESPACE_FIELD).eq(namespace),
                    where(DECORATOR_ID_FIELD).in(ids.toArray(Integer[]::new))));
            LOG.debug("Deleted decorator with ID {} and its history in namespace '{}'", currentId, namespace);
        } finally {
            lock.unlock();
        }
    }

    private Document find(String namespace, int id) {
        return decoratorCollection.find(byId(namespace, id)).firstOrNull();
    }

    private Document requireCurrent(String namespace, int id) throws DecoratorNotFoundException, DecoratorSupersededException {
        Document existing = find(namespace, id);
        if (existing == null) {
            throw new DecoratorNotFoundException();
        }
        if (existing.get(SUPERSEDED_BY_FIELD) != null) {
            throw new DecoratorSupersededException();
        }
        return existing;
    }

    private static Filter byId(String namespace, int id) {
        return Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(DECORATOR_ID_FIELD).eq(id));
    }

    private Stream<Document> inNamespace(String namespace, String type) {
        Filter filter = type == null || type.isEmpty()
                ? where(NAMESPACE_FIELD).eq(namespace)
                : Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(TYPE_FIELD).eq(type));
        List<Document> found = new ArrayList<>();
        decoratorCollection.find(filter).forEach(found::add);
        return found.stream().filter(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class) != null);
    }

    private Stream<Document> matching(String namespace, String target, String type) {
        return inNamespace(namespace, type)
                .filter(doc -> doc.get(SUPERSEDED_BY_FIELD) == null)
                .filter(doc -> matchesTarget(doc, target))
                .sorted(Comparator.comparing(doc -> doc.get(DECORATOR_ID_FIELD, Integer.class)));
    }

    private static boolean matchesTarget(Document doc, String target) {
        if (target == null || target.isBlank()) {
            return true;
        }
        return doc.get(TARGET_FIELD) instanceof List<?> targets && targets.contains(target);
    }

    private List<DecoratorHistoryEntry> historyEntries(String namespace) {
        return inNamespace(namespace, null)
                .map(doc -> new DecoratorHistoryEntry(
                        doc.get(DECORATOR_ID_FIELD, Integer.class),
                        doc.get(SUPERSEDES_FIELD, Integer.class),
                        doc.get(SUPERSEDED_BY_FIELD, Integer.class),
                        doc.get(SUPERSEDED_DATE_TIME_FIELD, String.class),
                        toDecorator(doc)))
                .toList();
    }

    private Decorator toDecorator(Document stored) {
        Document decorator = stored.get(DECORATOR_FIELD, Document.class);
        return decorator == null ? null : documentToDecorator(decorator).withTimestamps(
                stored.get(CREATION_DATE_TIME_FIELD, String.class), stored.get(UPDATE_DATE_TIME_FIELD, String.class));
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
}
