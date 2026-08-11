package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.store.PatternLayoutStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import static org.dizitart.no2.filters.FluentFilter.where;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * NitriteDB implementation of {@link PatternLayoutStore}, used in standalone mode.
 *
 * <h2>Document model</h2>
 * One flat document per {@code (namespace, patternId)} in its own {@code pattern_layouts}
 * collection, mirroring {@link org.finos.calm.store.mongo.MongoPatternLayoutStore} — see that
 * class's javadoc for why a separate collection is used rather than a discriminated extension
 * of {@code layouts}. As with {@link NitriteLayoutStore}, {@code layout} is kept as a raw JSON
 * string rather than a parsed document, and JSON is validated up front by
 * {@link #validateLayoutJson}, before any locking or existence checks.
 *
 * <h2>Concurrency</h2>
 * Identical to {@link NitriteLayoutStore}: all mutating operations run under a single
 * {@link ReentrantLock}, following the check-then-write pattern used by every other Nitrite
 * store.
 *
 * <h2>Existence check</h2>
 * Identical to {@link NitriteLayoutStore}: {@link #upsertLayout} rejects a write against a
 * pattern id with no header document by querying the {@code patterns} collection directly,
 * rather than delegating to {@code PatternStore#patternExists} and paying for a second
 * namespace-existence round trip.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitritePatternLayoutStore.class)
public class NitritePatternLayoutStore implements PatternLayoutStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitritePatternLayoutStore.class);
    private static final String COLLECTION_NAME = "pattern_layouts";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String PATTERN_ID_FIELD = "patternId";
    private static final String LAYOUT_FIELD = "layout";
    // Mirrors NitritePatternStore's HEADER_COLLECTION/ID_FIELD — see the class javadoc for why
    // this queries the collection directly instead of going through that store.
    private static final String PATTERN_HEADER_COLLECTION = "patterns";

    private final NitriteCollection layoutCollection;
    private final NitriteCollection patternHeaderCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final Lock lock = new ReentrantLock();

    @Inject
    public NitritePatternLayoutStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore) {
        this.layoutCollection = db.getCollection(COLLECTION_NAME);
        this.patternHeaderCollection = db.getCollection(PATTERN_HEADER_COLLECTION);
        this.namespaceStore = namespaceStore;
        LOG.info("NitritePatternLayoutStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public Optional<String> getLayout(String namespace, int patternId) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        Document document = fetchLayoutDocument(namespace, patternId);
        return document == null ? Optional.empty() : Optional.ofNullable(document.get(LAYOUT_FIELD, String.class));
    }

    @Override
    public void upsertLayout(String namespace, int patternId, String layoutJson)
            throws NamespaceNotFoundException, PatternNotFoundException {
        requireNamespace(namespace);
        if (!patternHeaderExists(namespace, patternId)) {
            throw new PatternNotFoundException();
        }
        validateLayoutJson(layoutJson);

        lock.lock();
        try {
            Document existing = fetchLayoutDocument(namespace, patternId);
            if (existing == null) {
                layoutCollection.insert(Document.createDocument(NAMESPACE_FIELD, namespace)
                        .put(PATTERN_ID_FIELD, patternId)
                        .put(LAYOUT_FIELD, layoutJson));
                LOG.debug("Created default layout for pattern {} in namespace '{}'", patternId, namespace);
                return;
            }
            existing.put(LAYOUT_FIELD, layoutJson);
            layoutCollection.update(existing);
            LOG.debug("Saved default layout for pattern {} in namespace '{}'", patternId, namespace);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<Integer> getPatternIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        List<Integer> patternIds = new ArrayList<>();
        for (Document document : layoutCollection.find(where(NAMESPACE_FIELD).eq(namespace))) {
            Integer patternId = document.get(PATTERN_ID_FIELD, Integer.class);
            if (patternId != null) {
                patternIds.add(patternId);
            }
        }
        return patternIds;
    }

    /**
     * Validates that the supplied layout JSON is parseable, throwing {@link JsonParseException} if not so the
     * REST layer can surface a 400. Mirrors {@code NitriteLayoutStore#validateLayoutJson}.
     */
    private void validateLayoutJson(String layoutJson) {
        if (layoutJson == null) {
            LOG.error("Layout JSON must not be null");
            throw new JsonParseException("Layout JSON must not be null");
        }
        try {
            org.bson.Document.parse(layoutJson);
        } catch (JsonParseException e) {
            LOG.error("Invalid JSON format for layout: {}", e.getMessage());
            throw e;
        }
    }

    private boolean patternHeaderExists(String namespace, int patternId) {
        Filter filter = Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(PATTERN_ID_FIELD).eq(patternId));
        return patternHeaderCollection.find(filter).firstOrNull() != null;
    }

    private Document fetchLayoutDocument(String namespace, int patternId) {
        Filter filter = Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(PATTERN_ID_FIELD).eq(patternId));
        return layoutCollection.find(filter).firstOrNull();
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found", namespace);
            throw new NamespaceNotFoundException();
        }
    }
}
