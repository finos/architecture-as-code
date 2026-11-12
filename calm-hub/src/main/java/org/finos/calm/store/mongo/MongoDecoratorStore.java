package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.Updates;
import com.mongodb.client.result.UpdateResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.types.Decimal128;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.util.DecoratorHistoryChain;
import org.finos.calm.store.util.DecoratorJson;
import org.finos.calm.store.util.MongoUpsertPush;
import org.finos.calm.store.util.MongoWriteFailures;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB implementation of DecoratorStore.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoDecoratorStore.class)
public class MongoDecoratorStore implements DecoratorStore {

    private static final Logger LOG = LoggerFactory.getLogger(MongoDecoratorStore.class);
    private static final String DECORATOR_ID_FIELD = "decoratorId";
    // Hub-owned history links, stored beside the decorator rather than in it.
    private static final String SUPERSEDES_FIELD = "supersedes";
    private static final String SUPERSEDED_BY_FIELD = "supersededBy";
    private static final int DECIMAL128_DIGITS = 34;
    private final MongoCollection<Document> decoratorCollection;
    private final MongoNamespaceStore namespaceStore;
    private final MongoCounterStore counterStore;

    @Inject
    public MongoDecoratorStore(MongoDatabase database, MongoNamespaceStore namespaceStore, MongoCounterStore counterStore) {
        this.decoratorCollection = database.getCollection("decorators");
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

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
        namespaceStore.requireNamespace(namespace);

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
        namespaceStore.requireNamespace(namespace);

        // Fetch only the entry, not the whole namespace document, which can be up to 16 MB.
        Document namespaceDocument = decoratorCollection.find(Filters.eq("namespace", namespace))
                .projection(Projections.elemMatch("decorators", Filters.eq(DECORATOR_ID_FIELD, id)))
                .first();
        if (namespaceDocument == null || namespaceDocument.isEmpty()) {
            return Optional.empty();
        }

        List<Document> decorators = extractDecorators(namespaceDocument, namespace);
        if (decorators.isEmpty()) {
            return Optional.empty();
        }

        return decorators.stream()
                .filter(decoratorDoc -> Integer.valueOf(id).equals(decoratorDoc.getInteger(DECORATOR_ID_FIELD)))
                .filter(decoratorDoc -> decoratorDoc.get("decorator", Document.class) != null)
                .map(MongoDecoratorStore::toDecorator)
                .findFirst();
    }

    @Override
    public int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        Document parsedDecorator = toBsonDocument(DecoratorJson.parseObject(decoratorJson));
        int id = counterStore.getNextDecoratorSequenceValue();
        Document decoratorDocument = new Document(DECORATOR_ID_FIELD, id)
                .append("decorator", parsedDecorator);

        try {
            MongoUpsertPush.pushWithDuplicateRetry(decoratorCollection,
                    Filters.eq("namespace", namespace),
                    "decorators", decoratorDocument);
        } catch (MongoWriteException e) {
            throw writeFailure(namespace, e);
        }

        LOG.debug("Created decorator with ID {} in namespace '{}'", id, namespace);
        return id;
    }

    @Override
    public void updateDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);

        Document parsedDecorator = toBsonDocument(DecoratorJson.parseObject(decoratorJson));

        long matched = write(namespace, () -> decoratorCollection.updateOne(
                currentEntryFilter(namespace, id),
                Updates.set("decorators.$.decorator", parsedDecorator)
        )).getMatchedCount();

        if (matched == 0) {
            throwSupersededOrNotFound(namespace, id);
        }

        LOG.debug("Updated decorator with ID {} in namespace '{}'", id, namespace);
    }

    @Override
    public int supersedeDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        namespaceStore.requireNamespace(namespace);

        Document parsedDecorator = toBsonDocument(DecoratorJson.parseObject(decoratorJson));
        // As in Nitrite, a refused supersede takes no ID, unless it loses a race to another write.
        if (decoratorCollection.countDocuments(currentEntryFilter(namespace, id)) == 0) {
            throwSupersededOrNotFound(namespace, id);
        }
        int newId = counterStore.getNextDecoratorSequenceValue();

        // Replace the links and append the successor in one atomic namespace-document update.
        Document successor = new Document(DECORATOR_ID_FIELD, newId)
                .append("decorator", parsedDecorator)
                .append(SUPERSEDES_FIELD, id);
        Document marked = new Document("$map", new Document("input", "$decorators")
                .append("as", "entry")
                .append("in", new Document("$cond", List.of(
                        new Document("$eq", List.of("$$entry.decoratorId", id)),
                        new Document("$mergeObjects", List.of("$$entry",
                                new Document(SUPERSEDED_BY_FIELD, newId))),
                        "$$entry"))));
        List<Document> update = List.of(new Document("$set", new Document("decorators",
                new Document("$concatArrays", List.of(marked,
                        new Document("$literal", List.of(successor)))))));
        long modified = write(namespace, () -> decoratorCollection.updateOne(currentEntryFilter(namespace, id), update)).getModifiedCount();

        if (modified == 0) {
            throwSupersededOrNotFound(namespace, id);
        }

        LOG.debug("Decorator with ID {} supersedes decorator {} in namespace '{}'", newId, id, namespace);
        return newId;
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

        List<Integer> ids = DecoratorHistoryChain.of(historyEntries(namespace), currentId).stream()
                .map(DecoratorHistoryEntry::getId)
                .toList();
        if (ids.isEmpty()) {
            throw new DecoratorNotFoundException();
        }

        long modified = write(namespace, () -> decoratorCollection.updateOne(currentEntryFilter(namespace, currentId),
                Updates.pull("decorators", Filters.in(DECORATOR_ID_FIELD, ids)))).getModifiedCount();

        if (modified == 0) {
            throwSupersededOrNotFound(namespace, currentId);
        }

        LOG.debug("Deleted decorator with ID {} and its history in namespace '{}'", currentId, namespace);
    }

    // A namespace document near 16 MB fails a write on the server. Map it as the version stores do.
    private static UpdateResult write(String namespace, Supplier<UpdateResult> update) {
        try {
            return update.get();
        } catch (MongoWriteException e) {
            throw writeFailure(namespace, e);
        }
    }

    private static StorageWriteException writeFailure(String namespace, MongoWriteException e) {
        LOG.error("Failed to write the decorators of namespace [{}]", namespace, e);
        return MongoWriteFailures.toStorageWriteException(e);
    }

    private static Bson currentEntryFilter(String namespace, int id) {
        return Filters.and(Filters.eq("namespace", namespace), Filters.elemMatch("decorators",
                Filters.and(Filters.eq(DECORATOR_ID_FIELD, id), Filters.exists(SUPERSEDED_BY_FIELD, false))));
    }

    // Called when a write that needs the current entry matched nothing.
    private void throwSupersededOrNotFound(String namespace, int id) throws DecoratorNotFoundException, DecoratorSupersededException {
        long withId = decoratorCollection.countDocuments(Filters.and(Filters.eq("namespace", namespace),
                Filters.elemMatch("decorators", Filters.eq(DECORATOR_ID_FIELD, id))));
        if (withId > 0) {
            throw new DecoratorSupersededException();
        }
        throw new DecoratorNotFoundException();
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

    private List<DecoratorHistoryEntry> historyEntries(String namespace) {
        Document namespaceDocument = fetchNamespaceDocument(namespace);
        if (namespaceDocument == null) {
            return List.of();
        }
        return extractDecorators(namespaceDocument, namespace).stream()
                .filter(doc -> doc.getInteger(DECORATOR_ID_FIELD) != null)
                .map(doc -> new DecoratorHistoryEntry(
                        doc.getInteger(DECORATOR_ID_FIELD),
                        doc.getInteger(SUPERSEDES_FIELD),
                        doc.getInteger(SUPERSEDED_BY_FIELD),
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

    private static Decorator toDecorator(Document entry) {
        return Decorator.fromDocument((Document) fromBsonValue(entry.get("decorator", Document.class)));
    }

    private Stream<Document> streamCurrent(List<Document> decorators) {
        return decorators.stream()
                .filter(doc -> doc.getInteger(DECORATOR_ID_FIELD) != null)
                .filter(doc -> doc.get(SUPERSEDED_BY_FIELD) == null);
    }

    private List<Integer> filterDecorators(List<Document> decorators, String target, String type) {
        return streamCurrent(decorators)
                .filter(doc -> {
                    Document decorator = doc.get("decorator", Document.class);
                    return decorator == null || matchesFilters(decorator, target, type);
                })
                .map(doc -> doc.getInteger(DECORATOR_ID_FIELD))
                .collect(Collectors.toList());
    }

    private List<Decorator> filterDecoratorsToValues(List<Document> decorators, String target, String type) {
        return streamCurrent(decorators)
                .filter(doc -> {
                    Document decorator = doc.get("decorator", Document.class);
                    return decorator != null && matchesFilters(decorator, target, type);
                })
                .map(MongoDecoratorStore::toDecorator)
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

    /**
     * Checks if the decorator matches the target filter (if provided)
     */
    private boolean matchesTargetFilter(Document decorator, String target) {
        if (target == null || target.isBlank()) {
            return true;
        }
        
        return decorator.get("target") instanceof List<?> targets && targets.contains(target);
    }
}
