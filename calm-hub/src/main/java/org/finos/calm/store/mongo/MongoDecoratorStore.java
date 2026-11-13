package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Aggregates;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.GraphLookupOptions;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.Sorts;
import com.mongodb.client.model.Updates;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.BsonMaximumSizeExceededException;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.types.Decimal128;
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
import org.finos.calm.store.util.MongoWriteFailures;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.finos.calm.store.util.DecoratorTimestamps.CREATION_DATE_TIME_FIELD;
import static org.finos.calm.store.util.DecoratorTimestamps.SUPERSEDED_DATE_TIME_FIELD;
import static org.finos.calm.store.util.DecoratorTimestamps.UPDATE_DATE_TIME_FIELD;

/**
 * MongoDB implementation of DecoratorStore.
 *
 * <p>One document per decorator. {@code type} and {@code target} are copied to the top level
 * so that the {@code (namespace, target, type)} index answers the filtered reads. See
 * {@code calm-hub/decisions/0020-decorator-storage-one-document-per-decorator.md}.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoDecoratorStore.class)
public class MongoDecoratorStore implements DecoratorStore {

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

    private static final Logger LOG = LoggerFactory.getLogger(MongoDecoratorStore.class);
    private static final int DECIMAL128_DIGITS = 34;

    private final MongoCollection<Document> decoratorCollection;
    private final MongoNamespaceStore namespaceStore;
    private final MongoCounterStore counterStore;

    @Inject
    public MongoDecoratorStore(MongoDatabase database, MongoNamespaceStore namespaceStore, MongoCounterStore counterStore) {
        this.decoratorCollection = database.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
    }

    /**
     * Builds the stored document for a decorator. The migration step uses it too, so that
     * migrated and new decorators have the same shape. The caller adds the Hub fields.
     */
    public static Document toStoredDocument(String namespace, int decoratorId, Document decorator) {
        Document stored = new Document(NAMESPACE_FIELD, namespace).append(DECORATOR_ID_FIELD, decoratorId);
        indexedFields(decorator).forEach(stored::append);
        return stored.append(DECORATOR_FIELD, decorator);
    }

    // Copied only with the types that the filters match, so a wrongly typed field matches no filter.
    private static Map<String, Object> indexedFields(Document decorator) {
        Map<String, Object> fields = new LinkedHashMap<>();
        if (decorator.get(TYPE_FIELD) instanceof String type) {
            fields.put(TYPE_FIELD, type);
        }
        if (decorator.get(TARGET_FIELD) instanceof List<?> target) {
            fields.put(TARGET_FIELD, target);
        }
        return fields;
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        List<Integer> ids = decoratorCollection.find(currentFilterFor(namespace, target, type))
                .projection(Projections.include(DECORATOR_ID_FIELD))
                .sort(Sorts.ascending(DECORATOR_ID_FIELD))
                .into(new ArrayList<>())
                .stream()
                .map(doc -> doc.getInteger(DECORATOR_ID_FIELD))
                .filter(Objects::nonNull)
                .toList();

        LOG.debug("Retrieved {} decorators for namespace '{}' with filters (target: {}, type: {})",
                ids.size(), namespace, target, type);
        return ids;
    }

    @Override
    public List<Decorator> getDecoratorValuesForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        List<Decorator> decorators = decoratorCollection.find(currentFilterFor(namespace, target, type))
                .sort(Sorts.ascending(DECORATOR_ID_FIELD))
                .into(new ArrayList<>())
                .stream()
                .map(MongoDecoratorStore::toDecorator)
                .filter(Objects::nonNull)
                .toList();

        LOG.debug("Retrieved {} decorator values for namespace '{}' with filters (target: {}, type: {})",
                decorators.size(), namespace, target, type);
        return decorators;
    }

    @Override
    public Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        Document stored = decoratorCollection.find(byId(namespace, id)).first();
        return stored == null ? Optional.empty() : Optional.ofNullable(toDecorator(stored));
    }

    @Override
    public int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        Document parsedDecorator = toBsonDocument(DecoratorJson.parseObject(decoratorJson));
        int id = counterStore.getNextDecoratorSequenceValue();
        String now = DecoratorTimestamps.now();
        Document stored = toStoredDocument(namespace, id, parsedDecorator)
                .append(CREATION_DATE_TIME_FIELD, now)
                .append(UPDATE_DATE_TIME_FIELD, now);

        write(namespace, () -> decoratorCollection.insertOne(stored));

        LOG.debug("Created decorator with ID {} in namespace '{}'", id, namespace);
        return id;
    }

    @Override
    public void updateDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);

        Document parsedDecorator = toBsonDocument(DecoratorJson.parseObject(decoratorJson));
        Map<String, Object> indexed = indexedFields(parsedDecorator);
        List<Bson> updates = new ArrayList<>();
        updates.add(Updates.set(DECORATOR_FIELD, parsedDecorator));
        updates.add(Updates.set(UPDATE_DATE_TIME_FIELD, DecoratorTimestamps.now()));
        for (String field : List.of(TYPE_FIELD, TARGET_FIELD)) {
            updates.add(indexed.containsKey(field) ? Updates.set(field, indexed.get(field)) : Updates.unset(field));
        }

        // Matched, not modified: an update with identical content is still a success.
        long matched = write(namespace, () -> decoratorCollection.updateOne(
                currentById(namespace, id), Updates.combine(updates))).getMatchedCount();
        if (matched == 0) {
            throwSupersededOrNotFound(namespace, id);
        }

        LOG.debug("Updated decorator with ID {} in namespace '{}'", id, namespace);
    }

    /**
     * Two writes, because a standalone MongoDB has no transactions. The mark on the old decorator
     * is the lock: a concurrent supersede of the same decorator then matches nothing.
     */
    @Override
    public int supersedeDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);

        Document parsedDecorator = toBsonDocument(DecoratorJson.parseObject(decoratorJson));
        // As in Nitrite, a refused supersede takes no ID, unless it loses a race to another write.
        if (decoratorCollection.countDocuments(currentById(namespace, id)) == 0) {
            throwSupersededOrNotFound(namespace, id);
        }
        int newId = counterStore.getNextDecoratorSequenceValue();
        String now = DecoratorTimestamps.now();

        long matched = write(namespace, () -> decoratorCollection.updateOne(currentById(namespace, id),
                Updates.combine(Updates.set(SUPERSEDED_BY_FIELD, newId), Updates.set(SUPERSEDED_DATE_TIME_FIELD, now))))
                .getMatchedCount();
        if (matched == 0) {
            throwSupersededOrNotFound(namespace, id);
        }

        Document successor = toStoredDocument(namespace, newId, parsedDecorator)
                .append(SUPERSEDES_FIELD, id)
                .append(CREATION_DATE_TIME_FIELD, now)
                .append(UPDATE_DATE_TIME_FIELD, now);
        try {
            write(namespace, () -> decoratorCollection.insertOne(successor));
        } catch (RuntimeException e) {
            // With no successor, the old decorator must be current again.
            decoratorCollection.updateOne(Filters.and(byId(namespace, id), Filters.eq(SUPERSEDED_BY_FIELD, newId)),
                    Updates.combine(Updates.unset(SUPERSEDED_BY_FIELD), Updates.unset(SUPERSEDED_DATE_TIME_FIELD)));
            throw e;
        }

        LOG.debug("Decorator with ID {} supersedes decorator {} in namespace '{}'", newId, id, namespace);
        return newId;
    }

    @Override
    public List<DecoratorHistoryEntry> getDecoratorHistory(String namespace, int id)
            throws NamespaceNotFoundException, DecoratorNotFoundException {
        namespaceStore.requireNamespace(namespace);

        List<DecoratorHistoryEntry> history = DecoratorHistoryChain.of(historyEntries(namespace, id), id);
        if (history.isEmpty()) {
            throw new DecoratorNotFoundException();
        }
        return history;
    }

    @Override
    public void deleteCurrentDecoratorHistory(String namespace, int currentId)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);

        List<Integer> olderIds = DecoratorHistoryChain.of(historyEntries(namespace, currentId), currentId).stream()
                .map(DecoratorHistoryEntry::getId)
                .filter(historyId -> historyId != currentId)
                .toList();

        // Delete the head only while it is current, so that a successor written meanwhile is kept.
        long deleted = write(namespace, () -> decoratorCollection.deleteOne(currentById(namespace, currentId)))
                .getDeletedCount();
        if (deleted == 0) {
            throwSupersededOrNotFound(namespace, currentId);
        }
        if (!olderIds.isEmpty()) {
            write(namespace, () -> decoratorCollection.deleteMany(
                    Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.in(DECORATOR_ID_FIELD, olderIds))));
        }

        LOG.debug("Deleted decorator with ID {} and its history in namespace '{}'", currentId, namespace);
    }

    // The 16 MB limit now applies to one decorator, not to the namespace. Map it as the version stores do.
    private static <T> T write(String namespace, Supplier<T> write) {
        try {
            return write.get();
        } catch (MongoWriteException e) {
            LOG.error("Failed to write a decorator of namespace [{}]", namespace, e);
            throw MongoWriteFailures.toStorageWriteException(e);
        } catch (BsonMaximumSizeExceededException e) {
            LOG.error("Failed to write a decorator of namespace [{}]", namespace, e);
            throw MongoWriteFailures.toStorageWriteException(e);
        }
    }

    // Called when a write that needs the current decorator matched nothing.
    private void throwSupersededOrNotFound(String namespace, int id) throws DecoratorNotFoundException, DecoratorSupersededException {
        if (decoratorCollection.countDocuments(byId(namespace, id)) > 0) {
            throw new DecoratorSupersededException();
        }
        throw new DecoratorNotFoundException();
    }

    // The history through id in one query: id, then each decorator after it and before it.
    private List<DecoratorHistoryEntry> historyEntries(String namespace, int id) {
        GraphLookupOptions inNamespace = new GraphLookupOptions()
                .restrictSearchWithMatch(Filters.eq(NAMESPACE_FIELD, namespace));
        Document result = decoratorCollection.aggregate(List.of(
                Aggregates.match(byId(namespace, id)),
                Aggregates.graphLookup(COLLECTION_NAME, "$" + SUPERSEDED_BY_FIELD,
                        SUPERSEDED_BY_FIELD, DECORATOR_ID_FIELD, "newer", inNamespace),
                Aggregates.graphLookup(COLLECTION_NAME, "$" + SUPERSEDES_FIELD,
                        SUPERSEDES_FIELD, DECORATOR_ID_FIELD, "older", inNamespace)
        )).first();
        if (result == null) {
            return List.of();
        }
        return Stream.of(Stream.of(result),
                        result.getList("newer", Document.class, List.of()).stream(),
                        result.getList("older", Document.class, List.of()).stream())
                .flatMap(entries -> entries)
                .filter(doc -> doc.getInteger(DECORATOR_ID_FIELD) != null)
                .map(doc -> new DecoratorHistoryEntry(
                        doc.getInteger(DECORATOR_ID_FIELD),
                        doc.getInteger(SUPERSEDES_FIELD),
                        doc.getInteger(SUPERSEDED_BY_FIELD),
                        doc.getString(SUPERSEDED_DATE_TIME_FIELD),
                        toDecorator(doc)))
                .toList();
    }

    // Not Document.parse, which decodes extended JSON: {"$numberInt": "1"} must stay the object that was validated.
    // A BSON key is a C string, so the driver cannot encode one with a NUL.
    static Document toBsonDocument(Map<?, ?> map) {
        Document document = new Document();
        map.forEach((key, value) -> {
            if (key.toString().indexOf('\0') >= 0) {
                throw DecoratorKeyRefusedException.nulCharacter();
            }
            document.append(key.toString(), toBsonValue(value));
        });
        return document;
    }

    private static Object toBsonValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            return toBsonDocument(map);
        }
        if (value instanceof List<?> list) {
            return list.stream().map(MongoDecoratorStore::toBsonValue).collect(Collectors.toCollection(ArrayList::new));
        }
        // BSON has no arbitrary-precision integer. Decimal128 keeps 34 digits exactly; a longer one becomes a double.
        if (value instanceof BigInteger big) {
            return big.abs().toString().length() <= DECIMAL128_DIGITS ? new Decimal128(new BigDecimal(big)) : big.doubleValue();
        }
        return value;
    }

    // Jackson cannot write a Decimal128, so data gets a JDK number again.
    private static Object fromBsonValue(Object value) {
        if (value instanceof Document document) {
            Document copy = new Document();
            document.forEach((key, item) -> copy.append(key, fromBsonValue(item)));
            return copy;
        }
        if (value instanceof List<?> list) {
            return list.stream().map(MongoDecoratorStore::fromBsonValue).collect(Collectors.toCollection(ArrayList::new));
        }
        if (value instanceof Decimal128 decimal && decimal.isFinite()) {
            try {
                BigDecimal number = decimal.bigDecimalValue();
                return number.scale() <= 0 ? number.toBigIntegerExact() : number;
            } catch (ArithmeticException negativeZero) {
                return BigDecimal.ZERO;
            }
        }
        return value;
    }

    private static Decorator toDecorator(Document stored) {
        Document content = stored.get(DECORATOR_FIELD, Document.class);
        if (content == null) {
            return null;
        }
        Decorator decorator = Decorator.fromDocument((Document) fromBsonValue(content));
        return decorator == null ? null
                : decorator.withTimestamps(stored.getString(CREATION_DATE_TIME_FIELD), stored.getString(UPDATE_DATE_TIME_FIELD));
    }

    private static Bson byId(String namespace, int id) {
        return Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(DECORATOR_ID_FIELD, id));
    }

    private static Bson currentById(String namespace, int id) {
        return Filters.and(byId(namespace, id), Filters.exists(SUPERSEDED_BY_FIELD, false));
    }

    /** {@code target} is an array, so {@code eq} matches when any element equals the value. */
    private static Bson currentFilterFor(String namespace, String target, String type) {
        List<Bson> filters = new ArrayList<>();
        filters.add(Filters.eq(NAMESPACE_FIELD, namespace));
        if (target != null && !target.isBlank()) {
            filters.add(Filters.eq(TARGET_FIELD, target));
        }
        if (type != null && !type.isEmpty()) {
            filters.add(Filters.eq(TYPE_FIELD, type));
        }
        filters.add(Filters.exists(SUPERSEDED_BY_FIELD, false));
        return Filters.and(filters);
    }
}
