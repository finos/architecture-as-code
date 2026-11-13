package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.Sorts;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * MongoDB implementation of DecoratorStore.
 *
 * <p>One document per decorator. {@code type} and {@code target} are copied to the top level
 * so that the {@code (namespace, target, type)} index answers the filtered reads. See
 * {@code calm-hub/decisions/0019-decorator-storage-one-document-per-decorator.md}.</p>
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

    private static final Logger LOG = LoggerFactory.getLogger(MongoDecoratorStore.class);

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
     * migrated and new decorators have the same shape.
     */
    public static Document toStoredDocument(String namespace, int decoratorId, Document decorator) {
        return new Document(NAMESPACE_FIELD, namespace)
                .append(DECORATOR_ID_FIELD, decoratorId)
                .append(TYPE_FIELD, decorator.get(TYPE_FIELD))
                .append(TARGET_FIELD, decorator.get(TARGET_FIELD))
                .append(DECORATOR_FIELD, decorator);
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        List<Integer> ids = decoratorCollection.find(filterFor(namespace, target, type))
                .projection(Projections.include(DECORATOR_ID_FIELD))
                .sort(Sorts.ascending(DECORATOR_ID_FIELD))
                .into(new ArrayList<>())
                .stream()
                .map(doc -> doc.getInteger(DECORATOR_ID_FIELD))
                .toList();

        LOG.debug("Retrieved {} decorators for namespace '{}' with filters (target: {}, type: {})",
                ids.size(), namespace, target, type);
        return ids;
    }

    @Override
    public List<Decorator> getDecoratorValuesForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        List<Decorator> decorators = decoratorCollection.find(filterFor(namespace, target, type))
                .sort(Sorts.ascending(DECORATOR_ID_FIELD))
                .into(new ArrayList<>())
                .stream()
                .map(doc -> doc.get(DECORATOR_FIELD, Document.class))
                .filter(Objects::nonNull)
                .map(Decorator::fromDocument)
                .toList();

        LOG.debug("Retrieved {} decorator values for namespace '{}' with filters (target: {}, type: {})",
                decorators.size(), namespace, target, type);
        return decorators;
    }

    @Override
    public Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        Document stored = decoratorCollection.find(byId(namespace, id)).first();
        if (stored == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(stored.get(DECORATOR_FIELD, Document.class)).map(Decorator::fromDocument);
    }

    @Override
    public int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        int id = counterStore.getNextDecoratorSequenceValue();
        decoratorCollection.insertOne(toStoredDocument(namespace, id, Document.parse(decoratorJson)));

        LOG.debug("Created decorator with ID {} in namespace '{}'", id, namespace);
        return id;
    }

    @Override
    public void updateDecorator(String namespace, int id, String decoratorJson) throws NamespaceNotFoundException, DecoratorNotFoundException {
        namespaceStore.requireNamespace(namespace);

        // Matched, not modified: an update with identical content is still a success.
        long matched = decoratorCollection.replaceOne(byId(namespace, id),
                toStoredDocument(namespace, id, Document.parse(decoratorJson))).getMatchedCount();
        if (matched == 0) {
            throw new DecoratorNotFoundException();
        }

        LOG.debug("Updated decorator with ID {} in namespace '{}'", id, namespace);
    }

    @Override
    public void deleteDecorator(String namespace, int id) throws NamespaceNotFoundException, DecoratorNotFoundException {
        namespaceStore.requireNamespace(namespace);

        if (decoratorCollection.deleteOne(byId(namespace, id)).getDeletedCount() == 0) {
            throw new DecoratorNotFoundException();
        }

        LOG.debug("Deleted decorator with ID {} in namespace '{}'", id, namespace);
    }

    private static Bson byId(String namespace, int id) {
        return Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(DECORATOR_ID_FIELD, id));
    }

    /** {@code target} is an array, so {@code eq} matches when any element equals the value. */
    private static Bson filterFor(String namespace, String target, String type) {
        List<Bson> filters = new ArrayList<>();
        filters.add(Filters.eq(NAMESPACE_FIELD, namespace));
        if (target != null && !target.isBlank()) {
            filters.add(Filters.eq(TARGET_FIELD, target));
        }
        if (type != null && !type.isEmpty()) {
            filters.add(Filters.eq(TYPE_FIELD, type));
        }
        return Filters.and(filters);
    }
}
