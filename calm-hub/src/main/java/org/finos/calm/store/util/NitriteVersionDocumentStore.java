package org.finos.calm.store.util;

import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.exceptions.NitriteException;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Comparator;
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
 *
 * <h2>Version spelling</h2>
 * Every method taking a {@code version} canonicalises it on entry via
 * {@link CanonicalVersion}, so the several spellings the API accepts address one
 * document rather than one each. Any method added here that takes a version must do
 * the same — and it matters more here than in the Mongo helper, since there is no
 * unique index to fall back on at all.
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

    /** The version every resource is created with. */
    public static final String INITIAL_VERSION = "1.0.0";

    private final NitriteCollection headerCollection;
    private final NitriteCollection versionCollection;
    private final String idField;
    private final String resourceLabel;
    private final VersionScheme versionScheme;
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
        this(headerCollection, versionCollection, idField, resourceLabel, VersionScheme.SEMANTIC);
    }

    /**
     * @param versionScheme how this type spells and ranks its versions. See
     *                      {@link VersionScheme}.
     */
    public NitriteVersionDocumentStore(NitriteCollection headerCollection,
                                       NitriteCollection versionCollection,
                                       String idField,
                                       String resourceLabel,
                                       VersionScheme versionScheme) {
        this.headerCollection = headerCollection;
        this.versionCollection = versionCollection;
        this.idField = idField;
        this.resourceLabel = resourceLabel;
        this.versionScheme = versionScheme;
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
     * Removes a header, used to compensate a resource creation whose first version write
     * failed. See {@link MongoVersionDocumentStore#deleteHeader} for why this exists.
     */
    public void deleteHeader(String namespace, int resourceId) {
        lock.writeLock().lock();
        try {
            headerCollection.remove(headerFilter(namespace, resourceId));
        } catch (NitriteException e) {
            LOG.warn("Failed to remove the header after a failed first version write "
                    + "[namespace={}, {}={}] — it may be left with no versions",
                    namespace, idField, resourceId, e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Writes the first version of a newly created resource, removing the header again if
     * that fails. See {@link MongoVersionDocumentStore#createFirstVersion} — the reasoning
     * for owning this here, and for treating {@code !created} as a real failure, is the
     * same on both backends.
     *
     * <p>Deliberately not held under a single write lock across both steps. Each call it
     * makes takes the lock itself, and widening that would mean holding the store-wide
     * write lock across a compensating delete for no gain: the resource id has just been
     * allocated and is not yet visible to any other caller.</p>
     */
    public void createFirstVersion(String namespace, int resourceId, String content) {
        boolean created;
        try {
            created = createVersion(namespace, resourceId, INITIAL_VERSION, content);
        } catch (RuntimeException e) {
            deleteHeader(namespace, resourceId);
            throw e;
        }
        if (!created) {
            deleteHeader(namespace, resourceId);
            throw StorageWriteException.writeFailed(new IllegalStateException(
                    "Version " + INITIAL_VERSION + " already exists for newly allocated "
                            + idField + " " + resourceId + " in namespace " + namespace));
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
        String canonicalVersion = versionScheme.canonicalise(version);
        lock.writeLock().lock();
        try {
            if (versionCollection.find(versionFilter(namespace, resourceId, canonicalVersion)).firstOrNull() != null) {
                return false;
            }
            versionCollection.insert(Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace)
                    .put(idField, resourceId)
                    .put(VERSION_FIELD, canonicalVersion)
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
        String canonicalVersion = versionScheme.canonicalise(version);
        lock.writeLock().lock();
        try {
            Filter filter = versionFilter(namespace, resourceId, canonicalVersion);
            Document existing = versionCollection.find(filter).firstOrNull();
            if (existing == null) {
                versionCollection.insert(Document.createDocument()
                        .put(NAMESPACE_FIELD, namespace)
                        .put(idField, resourceId)
                        .put(VERSION_FIELD, canonicalVersion)
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
     * Overwrites the header's {@code name} and {@code description}. See
     * {@link MongoVersionDocumentStore#updateHeaderDetails} for why this operation
     * exists, why a {@code null} is allowed to overwrite a real value, and why it must
     * be called only after the version write succeeds.
     */
    public void updateHeaderDetails(String namespace, int resourceId, String name, String description) {
        lock.writeLock().lock();
        try {
            Filter filter = headerFilter(namespace, resourceId);
            Document header = headerCollection.find(filter).firstOrNull();
            if (header == null) {
                LOG.warn("No header to update details on [namespace={}, {}={}]", namespace, idField, resourceId);
                return;
            }
            header.put(NAME_FIELD, name);
            header.put(DESCRIPTION_FIELD, description);
            headerCollection.update(filter, header);
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Updates the header's {@code name} and {@code description}, ignoring either that is
     * {@code null} or blank. See {@link MongoVersionDocumentStore#updatePresentHeaderDetails}
     * for why this exists alongside {@link #updateHeaderDetails}.
     */
    public void updatePresentHeaderDetails(String namespace, int resourceId, String name, String description) {
        if (!isPresent(name) && !isPresent(description)) {
            return;
        }
        lock.writeLock().lock();
        try {
            Filter filter = headerFilter(namespace, resourceId);
            Document header = headerCollection.find(filter).firstOrNull();
            if (header == null) {
                LOG.warn("No header to update details on [namespace={}, {}={}]", namespace, idField, resourceId);
                return;
            }
            if (isPresent(name)) {
                header.put(NAME_FIELD, name);
            }
            if (isPresent(description)) {
                header.put(DESCRIPTION_FIELD, description);
            }
            headerCollection.update(filter, header);
        } finally {
            lock.writeLock().unlock();
        }
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * @return the stored content for one version, or {@code null} if that version
     * (or the resource) doesn't exist.
     *
     * <p>Content that is present but not a string is reported the same way as absent
     * content. The typed accessor {@code get(key, String.class)} casts, so reading a
     * document whose {@code content} is a number or a nested document would throw a
     * {@code ClassCastException} out of the store and surface as a 500. The old
     * per-type stores guarded this with an {@code instanceof String} check and
     * returned their version-not-found exception, giving a 404; that guard was
     * dropped in the port and is restored here. A malformed stored document is not a
     * version the caller can read, and 404 says so without claiming the server broke.</p>
     */
    public String getVersion(String namespace, int resourceId, String version) {
        lock.readLock().lock();
        try {
            Document versionDocument = versionCollection
                    .find(versionFilter(namespace, resourceId, versionScheme.canonicalise(version))).firstOrNull();
            if (versionDocument == null) {
                return null;
            }
            Object content = versionDocument.get(CONTENT_FIELD);
            return content instanceof String stored ? stored : null;
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * @return every version of one resource, ordered by this store's version comparator.
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
            versions.sort(versionScheme.order());
            return versions;
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * @return the highest-ranking version of one resource, or {@code null} if it has none.
     * See {@link MongoVersionDocumentStore#getLatestVersion} for why this ranks in memory.
     */
    public String getLatestVersion(String namespace, int resourceId) {
        List<String> versions = listVersions(namespace, resourceId);
        return versions.isEmpty() ? null : versions.get(versions.size() - 1);
    }

    /**
     * @return the content of the highest-ranking version, or {@code null} if the resource has
     * no versions.
     */
    public String getLatestVersionContent(String namespace, int resourceId) {
        String latest = getLatestVersion(namespace, resourceId);
        return latest == null ? null : getVersion(namespace, resourceId, latest);
    }

    /**
     * @return how many resources of this type exist in a namespace. See
     * {@link MongoVersionDocumentStore#countHeaders} for why this exists.
     *
     * <p>A scan rather than an index count — CalmHub creates no Nitrite indexes — but it
     * reads only the small header documents, where sizing an ADR summary list would read
     * and parse every ADR's latest revision content.</p>
     */
    public int countHeaders(String namespace) {
        lock.readLock().lock();
        try {
            return (int) headerCollection.find(where(NAMESPACE_FIELD).eq(namespace)).size();
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
            // Null-safe because the id is read straight off the stored header and a header
            // missing its id field yields a null one. Comparing with Integer.compare unboxes,
            // so a single such document would NPE the whole listing into a 500 — where Mongo,
            // which sorts database-side, returns 200 with that row included. Sorting nulls
            // last keeps the two backends agreeing; toSummary already renders the row itself
            // ("<Type> null"), which is the honest representation of a malformed header.
            summaries.sort(Comparator.comparing(NamespaceResourceSummary::getId,
                    Comparator.nullsLast(Comparator.naturalOrder())));
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
