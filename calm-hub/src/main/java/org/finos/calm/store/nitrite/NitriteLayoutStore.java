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
import org.finos.calm.domain.exception.LayoutNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.LayoutStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

import static org.dizitart.no2.filters.FluentFilter.where;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * NitriteDB implementation of {@link LayoutStore}, used in standalone mode.
 *
 * <h2>Document model</h2>
 * One document per namespace in the {@code layouts} collection, holding a {@code layouts}
 * array of {@code {architectureId, layout}} entries, mirroring
 * {@link org.finos.calm.store.mongo.MongoLayoutStore} but with no {@code versions} level —
 * see {@link LayoutStore}'s class javadoc for why a layout isn't versioned.
 *
 * <p>Unlike the Mongo store, {@code layout} is kept as a raw JSON <b>string</b> rather than a
 * parsed document, matching {@code NitriteArchitectureStore}'s treatment of architecture
 * content. JSON is validated up front by {@link #validateLayoutJson}, before any locking or
 * existence checks, so a malformed payload is rejected consistently regardless of whether the
 * target architecture already has a saved layout.</p>
 *
 * <h2>Concurrency</h2>
 * All mutating operations run under a single {@link ReentrantLock}, following the
 * check-then-write pattern used by every other Nitrite store — there is no server-side atomic
 * conditional update to lean on the way Mongo does.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteLayoutStore.class)
public class NitriteLayoutStore implements LayoutStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteLayoutStore.class);
    private static final String COLLECTION_NAME = "layouts";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String LAYOUTS_FIELD = "layouts";
    private static final String ARCHITECTURE_ID_FIELD = "architectureId";
    private static final String LAYOUT_FIELD = "layout";

    private final NitriteCollection layoutCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final Lock lock = new ReentrantLock();

    @Inject
    public NitriteLayoutStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore) {
        this.layoutCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        LOG.info("NitriteLayoutStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public Optional<String> getLayout(String namespace, int architectureId) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        Document namespaceDoc = fetchNamespaceDocument(namespace);
        if (namespaceDoc == null) {
            return Optional.empty();
        }

        return findEntry(extractLayouts(namespaceDoc), architectureId)
                .map(entry -> entry.get(LAYOUT_FIELD, String.class));
    }

    @Override
    public void upsertLayout(String namespace, int architectureId, String layoutJson) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        validateLayoutJson(layoutJson);

        lock.lock();
        try {
            Document namespaceDoc = fetchNamespaceDocument(namespace);
            if (namespaceDoc == null) {
                Document entry = Document.createDocument(ARCHITECTURE_ID_FIELD, architectureId).put(LAYOUT_FIELD, layoutJson);
                Document newNamespaceDoc = Document.createDocument(NAMESPACE_FIELD, namespace)
                        .put(LAYOUTS_FIELD, new ArrayList<>(List.of(entry)));
                layoutCollection.insert(newNamespaceDoc);
                LOG.debug("Created default layout for architecture {} in namespace '{}'", architectureId, namespace);
                return;
            }

            List<Document> mutableLayouts = new ArrayList<>(extractLayouts(namespaceDoc));
            Optional<Document> existing = findEntry(mutableLayouts, architectureId);
            if (existing.isPresent()) {
                existing.get().put(LAYOUT_FIELD, layoutJson);
            } else {
                mutableLayouts.add(Document.createDocument(ARCHITECTURE_ID_FIELD, architectureId).put(LAYOUT_FIELD, layoutJson));
            }

            namespaceDoc.put(LAYOUTS_FIELD, mutableLayouts);
            layoutCollection.update(namespaceDoc);
            LOG.debug("Saved default layout for architecture {} in namespace '{}'", architectureId, namespace);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void deleteLayout(String namespace, int architectureId) throws NamespaceNotFoundException, LayoutNotFoundException {
        requireNamespace(namespace);

        lock.lock();
        try {
            Document namespaceDoc = fetchNamespaceDocument(namespace);
            if (namespaceDoc == null) {
                throw new LayoutNotFoundException();
            }

            List<Document> layouts = extractLayouts(namespaceDoc);
            List<Document> remaining = layouts.stream()
                    .filter(entry -> !matchesArchitecture(entry, architectureId))
                    .collect(Collectors.toCollection(ArrayList::new));
            if (remaining.size() == layouts.size()) {
                LOG.warn("No default layout found for architecture {} in namespace '{}' when deleting", architectureId, namespace);
                throw new LayoutNotFoundException();
            }

            namespaceDoc.put(LAYOUTS_FIELD, remaining);
            layoutCollection.update(namespaceDoc);
            LOG.debug("Deleted default layout for architecture {} in namespace '{}'", architectureId, namespace);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<Integer> getArchitectureIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        Document namespaceDoc = fetchNamespaceDocument(namespace);
        if (namespaceDoc == null) {
            return List.of();
        }

        return extractLayouts(namespaceDoc).stream()
                .map(entry -> entry.get(ARCHITECTURE_ID_FIELD, Integer.class))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /**
     * Validates that the supplied layout JSON is parseable, throwing {@link JsonParseException} if not so the
     * REST layer can surface a 400. Mirrors {@code NitriteArchitectureStore#validateArchitectureJson}.
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

    private Optional<Document> findEntry(List<Document> layouts, int architectureId) {
        return layouts.stream().filter(entry -> matchesArchitecture(entry, architectureId)).findFirst();
    }

    private boolean matchesArchitecture(Document entry, int architectureId) {
        return Integer.valueOf(architectureId).equals(entry.get(ARCHITECTURE_ID_FIELD, Integer.class));
    }

    private Document fetchNamespaceDocument(String namespace) {
        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        return layoutCollection.find(filter).firstOrNull();
    }

    private List<Document> extractLayouts(Document namespaceDoc) {
        TypeSafeNitriteDocument<Document> typeSafeDoc = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class);
        List<Document> layouts = typeSafeDoc.getList(LAYOUTS_FIELD);
        return layouts == null ? List.of() : layouts;
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found", namespace);
            throw new NamespaceNotFoundException();
        }
    }
}
