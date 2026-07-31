package org.finos.calm.store.util;

import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.exceptions.NitriteException;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB counterpart to {@link MongoVersionDocumentStore}: one <em>header</em>
 * document per {@code (namespace, resourceId)}, one <em>version</em> document per
 * {@code (namespace, resourceId, version)}. See
 * {@code calm-hub/decisions/0001-versioned-artefact-storage.md}.
 *
 * <h2>Why this isn't a mirror image of the Mongo helper</h2>
 * Two deliberate differences, both forced by the backend rather than chosen:
 * <ul>
 *   <li><b>Uniqueness is enforced here, not by the database.</b> CalmHub creates no
 *       Nitrite indexes at all, so there is no unique constraint to make a duplicate
 *       write fail. {@link #createVersion} therefore checks before writing, holding
 *       the write lock across both — which is genuinely safe, rather than a
 *       check-then-act race, because Nitrite is a single-process embedded store and
 *       this lock serialises every write through it. The Mongo helper can instead
 *       write optimistically and translate a {@code DUPLICATE_KEY} error, because
 *       there a shared database arbitrates between separate application instances.</li>
 *   <li><b>Content is stored as a JSON string</b>, not a parsed document, matching
 *       what the existing Nitrite stores already do.</li>
 * </ul>
 *
 * <h2>Locking</h2>
 * A single store-wide {@link ReentrantReadWriteLock}, matching the existing Nitrite
 * stores. Narrowing it is a possible optimisation but not a correctness fix — note
 * that any narrower lock must still serialise writes to the same
 * {@code (namespace, resourceId, version)}, or the uniqueness guarantee above stops
 * holding.
 */
public class NitriteVersionDocumentStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteVersionDocumentStore.class);

    static final String NAMESPACE_FIELD = "namespace";
    static final String VERSION_FIELD = "version";
    static final String CONTENT_FIELD = "content";
    static final String NAME_FIELD = "name";
    static final String DESCRIPTION_FIELD = "description";
    static final String VERSION_COUNT_FIELD = "versionCount";
    static final String METADATA_FIELD = "metadata";

    private final NitriteCollection headerCollection;
    private final NitriteCollection versionCollection;
    private final String idField;
    private final String resourceLabel;
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    /**
     * @param headerCollection  the existing per-type collection, now holding headers
     * @param versionCollection the new sibling version collection
     * @param idField           the type's numeric id field (e.g. {@code architectureId})
     * @param resourceLabel     human-readable type name, used only to synthesise a
     *                          display name when a header has none
     */
    public NitriteVersionDocumentStore(NitriteCollection headerCollection,
                                       NitriteCollection versionCollection,
                                       String idField,
                                       String resourceLabel) {
        this.headerCollection = headerCollection;
        this.versionCollection = versionCollection;
        this.idField = idField;
        this.resourceLabel = resourceLabel;
    }

    /**
     * @return {@code true} if the resource exists, regardless of how many versions
     * (including none) have been written for it.
     */
    public boolean headerExists(String namespace, int resourceId) {
        lock.readLock().lock();
        try {
            return headerCollection.find(headerFilter(namespace, resourceId)).firstOrNull() != null;
        } finally {
            lock.readLock().unlock();
        }
    }

    /** Inserts the header that makes a resource exist, with a zero version count. */
    public void createHeader(String namespace, int resourceId, String name, String description) {
        lock.writeLock().lock();
        try {
            headerCollection.insert(Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace)
                    .put(idField, resourceId)
                    .put(NAME_FIELD, name)
                    .put(DESCRIPTION_FIELD, description)
                    .put(VERSION_COUNT_FIELD, 0)
                    .put(METADATA_FIELD, Document.createDocument()));
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Writes a version that must not already exist.
     *
     * <p>The existence check and the insert both happen under the write lock, so no
     * concurrent caller can slip between them — see the class javadoc on why that
     * substitutes for a database constraint here.</p>
     *
     * @return {@code false} if that version is already present. Never overwrites.
     */
    public boolean createVersion(String namespace, int resourceId, String version, String content) {
        lock.writeLock().lock();
        try {
            if (versionCollection.find(versionFilter(namespace, resourceId, version)).firstOrNull() != null) {
                return false;
            }
            versionCollection.insert(Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace)
                    .put(idField, resourceId)
                    .put(VERSION_FIELD, version)
                    .put(CONTENT_FIELD, content)
                    .put(METADATA_FIELD, Document.createDocument()));
            incrementVersionCount(namespace, resourceId);
            return true;
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Writes a version whether or not it already exists, for the update-in-place path.
     *
     * <p>Replaces {@code content} on an existing version document while leaving its
     * {@code metadata} intact — overwriting wholesale would silently discard
     * per-version metadata. When no such version exists this inserts one, and only
     * then increments the header's {@code versionCount}, since this path can create
     * as well as overwrite.</p>
     */
    public void upsertVersion(String namespace, int resourceId, String version, String content) {
        lock.writeLock().lock();
        try {
            Filter filter = versionFilter(namespace, resourceId, version);
            Document existing = versionCollection.find(filter).firstOrNull();
            if (existing == null) {
                versionCollection.insert(Document.createDocument()
                        .put(NAMESPACE_FIELD, namespace)
                        .put(idField, resourceId)
                        .put(VERSION_FIELD, version)
                        .put(CONTENT_FIELD, content)
                        .put(METADATA_FIELD, Document.createDocument()));
                incrementVersionCount(namespace, resourceId);
                return;
            }
            existing.put(CONTENT_FIELD, content);
            versionCollection.update(filter, existing);
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * @return the stored content for one version, or {@code null} if that version
     * (or the resource) doesn't exist.
     */
    public String getVersion(String namespace, int resourceId, String version) {
        lock.readLock().lock();
        try {
            Document versionDocument = versionCollection.find(versionFilter(namespace, resourceId, version)).firstOrNull();
            return versionDocument == null ? null : versionDocument.get(CONTENT_FIELD, String.class);
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * @return every version of one resource, ordered by {@link SemanticVersionOrder}.
     * Empty means "no versions written" — <em>not</em> "no such resource"; ask
     * {@link #headerExists} to tell those apart.
     */
    public List<String> listVersions(String namespace, int resourceId) {
        lock.readLock().lock();
        try {
            List<String> versions = new ArrayList<>();
            for (Document versionDocument : versionCollection.find(headerFilter(namespace, resourceId))) {
                versions.add(versionDocument.get(VERSION_FIELD, String.class));
            }
            versions.sort(SemanticVersionOrder.ASCENDING);
            return versions;
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Lists resource summaries for a namespace.
     *
     * <p>Nitrite has no server-side paging equivalent, so the window is applied in
     * memory after materialising and sorting the namespace's headers — the same
     * approach the existing Nitrite stores take. Sorted by id so the window is
     * stable across calls.</p>
     */
    public List<NamespaceResourceSummary> listSummariesPaged(String namespace, PageRequest page) {
        lock.readLock().lock();
        try {
            List<NamespaceResourceSummary> summaries = new ArrayList<>();
            for (Document header : headerCollection.find(where(NAMESPACE_FIELD).eq(namespace))) {
                summaries.add(toSummary(header));
            }
            summaries.sort((left, right) -> Integer.compare(left.getId(), right.getId()));
            return page.apply(summaries);
        } finally {
            lock.readLock().unlock();
        }
    }

    private NamespaceResourceSummary toSummary(Document header) {
        Integer resourceId = header.get(idField, Integer.class);
        String name = header.get(NAME_FIELD, String.class);
        String description = header.get(DESCRIPTION_FIELD, String.class);
        Integer versionCount = header.get(VERSION_COUNT_FIELD, Integer.class);
        return new NamespaceResourceSummary(
                name == null ? resourceLabel + " " + resourceId : name,
                description == null ? "" : description,
                resourceId,
                versionCount == null ? 0 : versionCount);
    }

    /**
     * Keeps the header's denormalised {@code versionCount} in step with the version
     * collection. Always called with the write lock already held, and always
     * <em>after</em> the version document is stored.
     *
     * <p>Best-effort by design, matching {@code MongoVersionDocumentStore}: neither a
     * missing header nor a failure of the count write itself is worth failing an
     * otherwise-successful write over, since the version content is already stored.
     * Both leave the count understated until corrected — the drift ADR 0001 accepts.</p>
     */
    private void incrementVersionCount(String namespace, int resourceId) {
        try {
            Filter filter = headerFilter(namespace, resourceId);
            Document header = headerCollection.find(filter).firstOrNull();
            if (header == null) {
                LOG.warn("Wrote a version with no matching header to count it [namespace={}, {}={}] — "
                        + "versionCount for this resource is now understated", namespace, idField, resourceId);
                return;
            }
            Integer current = header.get(VERSION_COUNT_FIELD, Integer.class);
            header.put(VERSION_COUNT_FIELD, (current == null ? 0 : current) + 1);
            headerCollection.update(filter, header);
        } catch (NitriteException e) {
            LOG.warn("Failed to increment versionCount after writing a version [namespace={}, {}={}] — "
                    + "versionCount for this resource is now understated", namespace, idField, resourceId, e);
        }
    }

    private Filter headerFilter(String namespace, int resourceId) {
        return Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(idField).eq(resourceId));
    }

    private Filter versionFilter(String namespace, int resourceId, String version) {
        return Filter.and(where(NAMESPACE_FIELD).eq(namespace),
                where(idField).eq(resourceId),
                where(VERSION_FIELD).eq(version));
    }
}
