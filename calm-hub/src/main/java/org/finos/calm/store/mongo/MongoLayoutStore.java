package org.finos.calm.store.mongo;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.ReplaceOptions;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.BsonMaximumSizeExceededException;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.store.LayoutStore;
import org.finos.calm.store.util.MongoWriteFailures;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB implementation of {@link LayoutStore}.
 *
 * <h2>Document model</h2>
 * One flat document per {@code (namespace, architectureId)} in the {@code layouts} collection:
 * {@code {namespace, architectureId, layout}}, enforced by a unique index on
 * {@code (namespace, architectureId)} (see {@code MongoLayoutIndexStep}). {@code layout} is
 * stored as a parsed {@link Document}, matching how {@code MongoArchitectureStore} stores
 * architecture content. There is no {@code versions} map: a layout is not versioned (see
 * {@link LayoutStore}'s class javadoc).
 *
 * <p>This shape deliberately does not follow either of CALM Hub's two established patterns.
 * It is not the header/version split (ADR 0001) — there is no version axis, no sibling
 * {@code layoutVersions} collection, and the id comes from the architecture rather than an
 * allocator. And unlike Flow/Control/Decorator, it is not one document per namespace holding an
 * array either: that shape is what layout originally shipped with on this branch, and it is
 * growth-exposed in exactly the way ADR 0001 describes — a namespace with many or large diagram
 * layouts accumulates toward MongoDB's 16MB BSON ceiling in a single document. One flat document
 * per layout removes that ceiling as a practical concern, since a document is bounded by a
 * single layout rather than by a whole namespace's worth.
 *
 * <h2>Concurrency</h2>
 * Saving a layout is a single {@code replaceOne(filter, replacement, upsert(true))}. Concurrent
 * saves for the same architecture that both miss the filter can both attempt an insert; the
 * unique index admits exactly one, and the loser sees a {@code DUPLICATE_KEY} error. The
 * document exists by then, so the identical call is retried once — mirroring
 * {@code MongoUpsertPush}'s handling of the same race on a unique index. A second duplicate key
 * on the retry means the index no longer agrees with the filter, which is a fault rather than a
 * race, so it is surfaced rather than retried further. Two saves racing on the very same
 * architecture's layout are last-write-wins — acceptable for a layout, unlike for versioned
 * content.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoLayoutStore.class)
public class MongoLayoutStore implements LayoutStore {

    private static final Logger LOG = LoggerFactory.getLogger(MongoLayoutStore.class);
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ARCHITECTURE_ID_FIELD = "architectureId";
    private static final String LAYOUT_FIELD = "layout";

    private final MongoCollection<Document> layoutCollection;
    private final MongoNamespaceStore namespaceStore;

    @Inject
    public MongoLayoutStore(MongoDatabase database, MongoNamespaceStore namespaceStore) {
        this.layoutCollection = database.getCollection("layouts");
        this.namespaceStore = namespaceStore;
    }

    @Override
    public Optional<String> getLayout(String namespace, int architectureId) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        Document document = layoutCollection.find(layoutFilter(namespace, architectureId)).first();
        if (document == null) {
            return Optional.empty();
        }
        // A document with no readable layout is reported as "none saved" rather than as a
        // failure — matches the old array read's Objects::nonNull filter.
        return Optional.ofNullable(document.get(LAYOUT_FIELD, Document.class)).map(Document::toJson);
    }

    @Override
    public void upsertLayout(String namespace, int architectureId, String layoutJson) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        // Parsed before any write, so malformed JSON never reaches the database.
        Document layoutDoc = Document.parse(layoutJson);

        Bson filter = layoutFilter(namespace, architectureId);
        Document replacement = new Document(NAMESPACE_FIELD, namespace)
                .append(ARCHITECTURE_ID_FIELD, architectureId)
                .append(LAYOUT_FIELD, layoutDoc);
        ReplaceOptions upsert = new ReplaceOptions().upsert(true);

        try {
            replaceLayout(filter, replacement, upsert);
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() != ErrorCategory.DUPLICATE_KEY) {
                throw MongoWriteFailures.toStorageWriteException(e);
            }
            // Two saves for the same architecture both missed the filter and both attempted an
            // insert; the unique index on (namespace, architectureId) let exactly one through.
            // The document exists now, so the identical call matches and updates it. Retried
            // once only — a second duplicate key would mean the index no longer agrees with
            // this filter, which is a fault rather than a race to ride out.
            try {
                replaceLayout(filter, replacement, upsert);
            } catch (MongoWriteException retryFailure) {
                throw MongoWriteFailures.toStorageWriteException(retryFailure);
            }
        }
        LOG.debug("Saved default layout for architecture {} in namespace '{}'", architectureId, namespace);
    }

    @Override
    public List<Integer> getArchitectureIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        // Ids only. This guards namespace deletion and never needs the layouts themselves, so
        // there is no reason to parse every layout blob in the namespace just to read one
        // integer off each document.
        List<Integer> architectureIds = new ArrayList<>();
        layoutCollection.find(Filters.eq(NAMESPACE_FIELD, namespace))
                .projection(Projections.fields(Projections.include(ARCHITECTURE_ID_FIELD), Projections.excludeId()))
                .forEach(document -> {
                    Integer architectureId = document.getInteger(ARCHITECTURE_ID_FIELD);
                    if (architectureId != null) {
                        architectureIds.add(architectureId);
                    }
                });
        return architectureIds;
    }

    /**
     * Isolates the two ways MongoDB's 16MB ceiling can surface on this write: a
     * {@link MongoWriteException} when the server rejects an oversized document, or (since
     * unlike the old shape a single write can already exceed the ceiling before it is even
     * sent) a client-side {@link BsonMaximumSizeExceededException} the driver raises while
     * serializing the command, which never reaches the server and so is never a
     * {@code MongoWriteException}. Both must map to the same capacity-exceeded outcome.
     */
    private void replaceLayout(Bson filter, Document replacement, ReplaceOptions upsert) {
        try {
            layoutCollection.replaceOne(filter, replacement, upsert);
        } catch (BsonMaximumSizeExceededException e) {
            throw MongoWriteFailures.toStorageWriteException(e);
        }
    }

    private Bson layoutFilter(String namespace, int architectureId) {
        return Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(ARCHITECTURE_ID_FIELD, architectureId));
    }
}
