package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.ReplaceOptions;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.store.PatternLayoutStore;
import org.finos.calm.store.util.MongoUpsertRetry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB implementation of {@link PatternLayoutStore} — see that interface's class javadoc for
 * why patterns get their own collection rather than a {@code resourceType}-discriminated
 * extension of {@link MongoLayoutStore}.
 *
 * <h2>Document model</h2>
 * One flat document per {@code (namespace, patternId)} in its own {@code pattern_layouts}
 * collection: {@code {namespace, patternId, layout}}, enforced by a unique index on
 * {@code (namespace, patternId)} (see {@code MongoPatternLayoutIndexStep}). A structural twin of
 * {@link MongoLayoutStore} — see that class's javadoc for the full shape rationale.
 *
 * <h2>Concurrency</h2>
 * Identical to {@link MongoLayoutStore}: a single {@code replaceOne(filter, replacement,
 * upsert(true))}, retried once on a concurrent-insert {@code DUPLICATE_KEY} race via
 * {@link MongoUpsertRetry}.
 *
 * <h2>Existence check</h2>
 * Identical to {@link MongoLayoutStore}: {@link #upsertLayout} rejects a write against a
 * pattern id with no header document by querying the {@code patterns} collection directly,
 * rather than delegating to {@code PatternStore#patternExists} and paying for a second
 * namespace-existence round trip.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoPatternLayoutStore.class)
public class MongoPatternLayoutStore implements PatternLayoutStore {

    private static final Logger LOG = LoggerFactory.getLogger(MongoPatternLayoutStore.class);
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String PATTERN_ID_FIELD = "patternId";
    private static final String LAYOUT_FIELD = "layout";
    // Mirrors MongoPatternStore's HEADER_COLLECTION/ID_FIELD — see the class javadoc for why
    // this queries the collection directly instead of going through that store.
    private static final String PATTERN_HEADER_COLLECTION = "patterns";

    private final MongoCollection<Document> layoutCollection;
    private final MongoCollection<Document> patternHeaderCollection;
    private final MongoNamespaceStore namespaceStore;

    @Inject
    public MongoPatternLayoutStore(MongoDatabase database, MongoNamespaceStore namespaceStore) {
        this.layoutCollection = database.getCollection("pattern_layouts");
        this.patternHeaderCollection = database.getCollection(PATTERN_HEADER_COLLECTION);
        this.namespaceStore = namespaceStore;
    }

    @Override
    public Optional<String> getLayout(String namespace, int patternId) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        Document document = layoutCollection.find(layoutFilter(namespace, patternId)).first();
        if (document == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(document.get(LAYOUT_FIELD, Document.class)).map(Document::toJson);
    }

    @Override
    public void upsertLayout(String namespace, int patternId, String layoutJson)
            throws NamespaceNotFoundException, PatternNotFoundException {
        requireNamespace(namespace);
        if (!patternHeaderExists(namespace, patternId)) {
            throw new PatternNotFoundException();
        }

        // Parsed before any write, so malformed JSON never reaches the database.
        Document layoutDoc = Document.parse(layoutJson);

        Bson filter = layoutFilter(namespace, patternId);
        Document replacement = new Document(NAMESPACE_FIELD, namespace)
                .append(PATTERN_ID_FIELD, patternId)
                .append(LAYOUT_FIELD, layoutDoc);
        ReplaceOptions upsert = new ReplaceOptions().upsert(true);

        MongoUpsertRetry.replaceOnceWithRetry(layoutCollection, filter, replacement, upsert);
        LOG.debug("Saved default layout for pattern {} in namespace '{}'", patternId, namespace);
    }

    @Override
    public List<Integer> getPatternIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        List<Integer> patternIds = new ArrayList<>();
        layoutCollection.find(Filters.eq(NAMESPACE_FIELD, namespace))
                .projection(Projections.fields(Projections.include(PATTERN_ID_FIELD), Projections.excludeId()))
                .forEach(document -> {
                    Integer patternId = document.getInteger(PATTERN_ID_FIELD);
                    if (patternId != null) {
                        patternIds.add(patternId);
                    }
                });
        return patternIds;
    }

    private Bson layoutFilter(String namespace, int patternId) {
        return Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(PATTERN_ID_FIELD, patternId));
    }

    private boolean patternHeaderExists(String namespace, int patternId) {
        return patternHeaderCollection
                .find(Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(PATTERN_ID_FIELD, patternId)))
                .projection(Projections.include("_id"))
                .first() != null;
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found", namespace);
            throw new NamespaceNotFoundException();
        }
    }
}
