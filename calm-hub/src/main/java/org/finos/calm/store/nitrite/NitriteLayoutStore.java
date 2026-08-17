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
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.LayoutStore;
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
 * NitriteDB implementation of {@link LayoutStore}, used in standalone mode.
 *
 * <h2>Document model</h2>
 * One flat document per {@code (namespace, architectureId)} in the {@code layouts} collection,
 * mirroring {@link org.finos.calm.store.mongo.MongoLayoutStore} — see that class's javadoc for
 * why this shape was chosen over both the header/version split (ADR 0001) and a
 * one-document-per-namespace array. There is no {@code versions} level — see
 * {@link LayoutStore}'s class javadoc for why a layout isn't versioned.
 *
 * <p>Unlike the Mongo store, {@code layout} is kept as a raw JSON <b>string</b> rather than a
 * parsed document, matching {@code NitriteArchitectureStore}'s treatment of architecture
 * content. JSON is validated up front by {@link #validateLayoutJson}, before any locking or
 * existence checks, so a malformed payload is rejected consistently regardless of whether the
 * target architecture already has a saved layout.</p>
 *
 * <h2>Concurrency</h2>
 * All mutating operations run under a single {@link ReentrantLock}, following the
 * check-then-write pattern used by every other Nitrite store — Nitrite has no unique indexes
 * anywhere in this codebase (see {@code NitriteVersionSplitMigration}'s javadoc), so there is no
 * server-side atomic conditional update to lean on the way Mongo does. Flattening the document
 * shape does not remove the need for the lock, only its cost: the critical section used to
 * serialize a full-namespace read-modify-write of a growing array; it is now a small find plus a
 * single-document insert or update.
 *
 * <h2>Existence check</h2>
 * {@link #upsertLayout} rejects a write against an architecture id with no header document, by
 * querying the {@code architectures} collection directly rather than delegating to
 * {@code ArchitectureStore#architectureExists} — that method does its own
 * {@code requireNamespace} call, and calling it from here would mean two namespace-existence
 * round trips per save instead of one.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteLayoutStore.class)
public class NitriteLayoutStore implements LayoutStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteLayoutStore.class);
    private static final String COLLECTION_NAME = "layouts";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ARCHITECTURE_ID_FIELD = "architectureId";
    private static final String LAYOUT_FIELD = "layout";
    // Mirrors NitriteArchitectureStore's HEADER_COLLECTION/ID_FIELD — see the class javadoc
    // for why this queries the collection directly instead of going through that store.
    private static final String ARCHITECTURE_HEADER_COLLECTION = "architectures";

    private final NitriteCollection layoutCollection;
    private final NitriteCollection architectureHeaderCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final Lock lock = new ReentrantLock();

    @Inject
    public NitriteLayoutStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore) {
        this.layoutCollection = db.getCollection(COLLECTION_NAME);
        this.architectureHeaderCollection = db.getCollection(ARCHITECTURE_HEADER_COLLECTION);
        this.namespaceStore = namespaceStore;
        LOG.info("NitriteLayoutStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public Optional<String> getLayout(String namespace, int architectureId) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        Document document = fetchLayoutDocument(namespace, architectureId);
        return document == null ? Optional.empty() : Optional.ofNullable(document.get(LAYOUT_FIELD, String.class));
    }

    @Override
    public void upsertLayout(String namespace, int architectureId, String layoutJson)
            throws NamespaceNotFoundException, ArchitectureNotFoundException {
        namespaceStore.requireNamespace(namespace);
        if (!architectureHeaderExists(namespace, architectureId)) {
            throw new ArchitectureNotFoundException();
        }
        validateLayoutJson(layoutJson);

        lock.lock();
        try {
            Document existing = fetchLayoutDocument(namespace, architectureId);
            if (existing == null) {
                layoutCollection.insert(Document.createDocument(NAMESPACE_FIELD, namespace)
                        .put(ARCHITECTURE_ID_FIELD, architectureId)
                        .put(LAYOUT_FIELD, layoutJson));
                LOG.debug("Created default layout for architecture {} in namespace '{}'", architectureId, namespace);
                return;
            }
            existing.put(LAYOUT_FIELD, layoutJson);
            layoutCollection.update(existing);
            LOG.debug("Saved default layout for architecture {} in namespace '{}'", architectureId, namespace);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<Integer> getArchitectureIdsWithLayoutForNamespace(String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        // Not using DocumentCursor#project here: Nitrite applies a projection in memory after
        // reading the full document from the store, so it saves nothing at the I/O layer and
        // only complicates the read below for no benefit.
        List<Integer> architectureIds = new ArrayList<>();
        for (Document document : layoutCollection.find(where(NAMESPACE_FIELD).eq(namespace))) {
            Integer architectureId = document.get(ARCHITECTURE_ID_FIELD, Integer.class);
            if (architectureId != null) {
                architectureIds.add(architectureId);
            }
        }
        return architectureIds;
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

    private boolean architectureHeaderExists(String namespace, int architectureId) {
        Filter filter = Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(ARCHITECTURE_ID_FIELD).eq(architectureId));
        return architectureHeaderCollection.find(filter).firstOrNull() != null;
    }

    private Document fetchLayoutDocument(String namespace, int architectureId) {
        Filter filter = Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(ARCHITECTURE_ID_FIELD).eq(architectureId));
        return layoutCollection.find(filter).firstOrNull();
    }
}
