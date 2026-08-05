package org.finos.calm.store.mongo;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import com.mongodb.client.result.UpdateResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.exception.LayoutNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.store.LayoutStore;
import org.finos.calm.store.util.MongoWriteFailures;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB implementation of {@link LayoutStore}.
 *
 * <h2>Document model</h2>
 * One document per namespace in the {@code layouts} collection, holding a {@code layouts}
 * array of {@code {architectureId, layout}} entries — the same "one document per namespace,
 * entities appended into an array" shape as {@code MongoDecoratorStore}, but with no
 * {@code versions} map: a layout is not versioned (see {@link LayoutStore}'s class javadoc).
 * {@code layout} is stored as a parsed {@link Document}, matching how
 * {@code MongoArchitectureStore} stores architecture content.
 *
 * <h2>Concurrency</h2>
 * Saving a layout is an upsert into an array element keyed by {@code architectureId}, which
 * Mongo cannot do atomically in one operation. {@link #upsertLayout} tries an in-place
 * {@code $set} on a matching array element first; if none exists yet it does a conditional
 * {@code $push} (guarded so it only fires when no element with that id exists), retrying the
 * {@code $set} once if a concurrent writer created the entry in between. Two saves racing on
 * the very same architecture's layout are last-write-wins — acceptable for a layout, unlike
 * for versioned content.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoLayoutStore.class)
public class MongoLayoutStore implements LayoutStore {

    private static final Logger LOG = LoggerFactory.getLogger(MongoLayoutStore.class);
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String LAYOUTS_FIELD = "layouts";
    private static final String ARCHITECTURE_ID_FIELD = "architectureId";
    private static final String ENTRY_ID_PATH = LAYOUTS_FIELD + "." + ARCHITECTURE_ID_FIELD;

    private final MongoCollection<Document> layoutCollection;
    private final MongoNamespaceStore namespaceStore;

    @Inject
    public MongoLayoutStore(MongoDatabase database, MongoNamespaceStore namespaceStore) {
        this.layoutCollection = database.getCollection("layouts");
        this.namespaceStore = namespaceStore;
    }

    @Override
    public Optional<String> getLayout(String namespace, int architectureId) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        Document namespaceDoc = fetchNamespaceDocument(namespace);
        if (namespaceDoc == null) {
            return Optional.empty();
        }

        return extractLayouts(namespaceDoc).stream()
                .filter(entry -> Integer.valueOf(architectureId).equals(entry.getInteger(ARCHITECTURE_ID_FIELD)))
                .map(entry -> entry.get("layout", Document.class))
                .filter(Objects::nonNull)
                .map(Document::toJson)
                .findFirst();
    }

    @Override
    public void upsertLayout(String namespace, int architectureId, String layoutJson) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        // Parsed before any write, so malformed JSON never reaches the database.
        Document layoutDoc = Document.parse(layoutJson);

        if (trySetExisting(namespace, architectureId, layoutDoc)) {
            return;
        }
        if (tryPushNew(namespace, architectureId, layoutDoc)) {
            return;
        }
        // Lost the race either way: a concurrent writer created the namespace document, or
        // the array entry, between the two attempts above. Either way the entry now exists,
        // so retrying the $set once resolves it. If it still doesn't match (e.g. a concurrent
        // delete removed the entry again in that same window), surface a write failure instead
        // of silently returning as if the save had succeeded.
        if (!trySetExisting(namespace, architectureId, layoutDoc)) {
            throw StorageWriteException.writeFailed(new IllegalStateException(
                    "Failed to persist layout for architecture " + architectureId
                            + " in namespace '" + namespace + "' after retry"));
        }
    }

    @Override
    public void deleteLayout(String namespace, int architectureId) throws NamespaceNotFoundException, LayoutNotFoundException {
        requireNamespace(namespace);

        long modified = layoutCollection.updateOne(
                Filters.eq(NAMESPACE_FIELD, namespace),
                Updates.pullByFilter(Filters.eq(LAYOUTS_FIELD, Filters.eq(ARCHITECTURE_ID_FIELD, architectureId)))
        ).getModifiedCount();

        if (modified == 0) {
            LOG.warn("No default layout found for architecture {} in namespace '{}' when deleting", architectureId, namespace);
            throw new LayoutNotFoundException();
        }
        LOG.debug("Deleted default layout for architecture {} in namespace '{}'", architectureId, namespace);
    }

    @Override
    public List<Integer> getArchitectureIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        Document namespaceDoc = fetchNamespaceDocument(namespace);
        if (namespaceDoc == null) {
            return List.of();
        }

        return extractLayouts(namespaceDoc).stream()
                .map(entry -> entry.getInteger(ARCHITECTURE_ID_FIELD))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /**
     * Attempts to overwrite the {@code layout} of an existing array entry in place.
     *
     * @return true if an entry was found and updated
     */
    private boolean trySetExisting(String namespace, int architectureId, Document layoutDoc) {
        try {
            long modified = layoutCollection.updateOne(
                    Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(ENTRY_ID_PATH, architectureId)),
                    Updates.set(LAYOUTS_FIELD + ".$.layout", layoutDoc)
            ).getModifiedCount();
            return modified > 0;
        } catch (MongoWriteException e) {
            // Namespace documents holding a layouts array share Flow's one-document-per-namespace
            // shape, so this $set can cross the 16MB BSON ceiling. Map it the same way tryPushNew
            // does, rather than letting it escape unmapped past StorageWriteExceptionMapper.
            throw MongoWriteFailures.toStorageWriteException(e);
        }
    }

    /**
     * Attempts to append a brand-new array entry, guarded so it only applies when no entry
     * for this {@code architectureId} exists yet — otherwise two concurrent saves of a new
     * layout could each push their own entry, leaving duplicates. Also upserts the namespace
     * document itself if it doesn't exist yet, mirroring {@code MongoUpsertPush}'s handling of
     * the resulting duplicate-key race on the namespace's unique index.
     *
     * @return true if the entry was appended (including via a fresh namespace document)
     */
    private boolean tryPushNew(String namespace, int architectureId, Document layoutDoc) {
        Document entry = new Document(ARCHITECTURE_ID_FIELD, architectureId).append("layout", layoutDoc);
        Bson filter = Filters.and(
                Filters.eq(NAMESPACE_FIELD, namespace),
                Filters.nor(Filters.elemMatch(LAYOUTS_FIELD, Filters.eq(ARCHITECTURE_ID_FIELD, architectureId))));
        UpdateOptions options = new UpdateOptions().upsert(true);

        try {
            UpdateResult result = layoutCollection.updateOne(filter, Updates.push(LAYOUTS_FIELD, entry), options);
            return result.getUpsertedId() != null || result.getModifiedCount() > 0;
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() != ErrorCategory.DUPLICATE_KEY) {
                throw MongoWriteFailures.toStorageWriteException(e);
            }
            // Lost the race to create the namespace document — it exists now, the caller retries.
            return false;
        }
    }

    private Document fetchNamespaceDocument(String namespace) {
        return layoutCollection.find(Filters.eq(NAMESPACE_FIELD, namespace)).first();
    }

    private List<Document> extractLayouts(Document namespaceDoc) {
        List<Document> layouts = namespaceDoc.getList(LAYOUTS_FIELD, Document.class);
        return layouts == null ? List.of() : layouts;
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found", namespace);
            throw new NamespaceNotFoundException();
        }
    }
}
