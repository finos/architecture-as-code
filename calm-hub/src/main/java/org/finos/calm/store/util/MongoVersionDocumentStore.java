package org.finos.calm.store.util;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoException;
import com.mongodb.MongoWriteException;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.Sorts;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import com.mongodb.client.result.UpdateResult;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared MongoDB access for the header/version document shape: one <em>header</em>
 * document per {@code (namespace, resourceId)} recording that a resource exists, and
 * one <em>version</em> document per {@code (namespace, resourceId, version)} holding
 * that version's content.
 *
 * <p>Replaces the "one document per namespace, holding an array of resources, each
 * with an embedded map of every version's content" shape, which grew without bound
 * and risked MongoDB's hard 16MB per-document limit. See
 * {@code calm-hub/decisions/0001-versioned-artefact-storage.md}.</p>
 *
 * <h2>Not a base class</h2>
 * Each resource type's store composes one of these rather than extending it,
 * matching the codebase's existing static-helper convention ({@link MongoUpsertPush};
 * {@code MongoResourceSlice} was the other, and was deleted once Pattern migrated and
 * left it with no callers). The type-specific parts — the id field name, the
 * label used when a stored {@code name} is missing — are constructor arguments, so
 * one instance serves exactly one resource type.
 *
 * <h2>Existence is the header's job</h2>
 * A header may legitimately have zero version documents, so an empty
 * {@link #listVersions} is <em>not</em> evidence the resource doesn't exist. Callers
 * that need to tell "exists, no versions yet" from "doesn't exist" must ask
 * {@link #headerExists}.
 *
 * <h2>Concurrency</h2>
 * Uniqueness is enforced by the database, not by check-then-write here: the unique
 * index on {@code (namespace, resourceId, version)} makes a losing concurrent
 * writer fail with {@code DUPLICATE_KEY}, which {@link #createVersion} reports as
 * {@code false}. Those indexes are created by the per-type schema migration step,
 * not by this class.
 *
 * <h2>Version spelling</h2>
 * Every method taking a {@code version} canonicalises it on entry via
 * {@link CanonicalVersion}, so the several spellings the API accepts address one
 * document rather than one each. Any method added here that takes a version must do
 * the same — the database's uniqueness guarantee is per stored string, so it cannot
 * catch a spelling that slipped through uncanonicalised.
 */
public class MongoVersionDocumentStore {

    private static final Logger LOG = LoggerFactory.getLogger(MongoVersionDocumentStore.class);

    static final String NAMESPACE_FIELD = "namespace";
    static final String VERSION_FIELD = "version";
    static final String CONTENT_FIELD = "content";
    static final String NAME_FIELD = "name";
    static final String DESCRIPTION_FIELD = "description";
    static final String VERSION_COUNT_FIELD = "versionCount";
    static final String METADATA_FIELD = "metadata";

    /** The version every resource is created with. */
    public static final String INITIAL_VERSION = "1.0.0";

    private final MongoCollection<Document> headerCollection;
    private final MongoCollection<Document> versionCollection;
    private final String idField;
    private final String resourceLabel;
    private final VersionScheme versionScheme;

    /**
     * @param headerCollection  the existing per-type collection, now holding headers
     *                          (e.g. {@code architectures})
     * @param versionCollection the new sibling version collection
     *                          (e.g. {@code architectureVersions})
     * @param idField           the type's numeric id field (e.g. {@code architectureId})
     * @param resourceLabel     human-readable type name, used only to synthesise a
     *                          display name when a header has none (e.g. {@code Architecture})
     */
    public MongoVersionDocumentStore(MongoCollection<Document> headerCollection,
                                     MongoCollection<Document> versionCollection,
                                     String idField,
                                     String resourceLabel) {
        this(headerCollection, versionCollection, idField, resourceLabel, VersionScheme.SEMANTIC);
    }

    /**
     * @param versionScheme how this type spells and ranks its versions. Every type but
     *                      ADR uses {@link VersionScheme#SEMANTIC}; ADR's revisions are
     *                      integers, which must be stored verbatim and ordered numerically
     *                      — see {@link VersionScheme}.
     */
    public MongoVersionDocumentStore(MongoCollection<Document> headerCollection,
                                     MongoCollection<Document> versionCollection,
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
        return headerCollection.find(headerFilter(namespace, resourceId))
                .projection(Projections.include("_id"))
                .first() != null;
    }

    /**
     * Inserts the header that makes a resource exist, with a zero version count and
     * empty metadata.
     *
     * <p>A plain insert with no duplicate-key retry: unlike the old shape — where
     * concurrent first-writes to a new namespace raced to create the shared namespace
     * document (see {@link MongoUpsertPush}) — {@code resourceId} comes from the
     * atomic counter before this is called, so there is no race to lose.</p>
     */
    public void createHeader(String namespace, int resourceId, String name, String description) {
        Document header = new Document(NAMESPACE_FIELD, namespace)
                .append(idField, resourceId)
                .append(NAME_FIELD, name)
                .append(DESCRIPTION_FIELD, description)
                .append(VERSION_COUNT_FIELD, 0)
                .append(METADATA_FIELD, new Document());
        try {
            headerCollection.insertOne(header);
        } catch (MongoWriteException e) {
            LOG.error("Failed to create header [namespace={}, {}={}]", namespace, idField, resourceId, e);
            throw MongoWriteFailures.toStorageWriteException(e);
        }
    }

    /**
     * Removes a header, used to compensate a resource creation whose first version write
     * failed.
     *
     * <p>The old shape pushed the resource and its first version in one document write, so
     * a failure left nothing behind. Splitting them means a failed version write can strand
     * a header that no API can remove — there is no delete endpoint for these types — and it
     * would show up in listings and search with {@code versionCount: 0} forever.</p>
     *
     * <p>Not a general-purpose delete: nothing else calls this, and it deliberately does not
     * touch the version collection, because the only caller has just failed to write the
     * one version that could exist.</p>
     */
    public void deleteHeader(String namespace, int resourceId) {
        try {
            headerCollection.deleteOne(headerFilter(namespace, resourceId));
        } catch (MongoException e) {
            // Best-effort: the caller is already failing, and reporting this instead would
            // replace a real write failure with a misleading one.
            LOG.warn("Failed to remove the header after a failed first version write "
                    + "[namespace={}, {}={}] — it may be left with no versions",
                    namespace, idField, resourceId, e);
        }
    }

    /**
     * Writes the first version of a newly created resource, removing the header again if
     * that fails, so a half-created resource never survives the request.
     *
     * <p>This lives here rather than in each store because it is the {@link #createVersion}
     * / {@link #deleteHeader} pair used correctly, and getting it wrong is not recoverable:
     * there is no delete endpoint for any of these types, so a header stranded with
     * {@code versionCount: 0} stays visible in listings and search permanently. Each store
     * having its own copy meant a fix applied to one and missed in another, with nothing to
     * flag the difference.</p>
     *
     * <p>The {@code !created} branch looks impossible and is treated as a genuine failure
     * anyway: {@code resourceId} has just been allocated from the counter, so nothing should
     * already hold its version 1.0.0. If something does — a rewound counter, a restored
     * database — reporting success would return 201 for content that was never stored.</p>
     */
    public void createFirstVersion(String namespace, int resourceId, Document content) {
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
     * @return {@code false} if that version is already present — the caller decides
     * which domain exception that means. Never overwrites.
     */
    public boolean createVersion(String namespace, int resourceId, String version, Document content) {
        String canonicalVersion = versionScheme.canonicalise(version);
        Document versionDocument = new Document(NAMESPACE_FIELD, namespace)
                .append(idField, resourceId)
                .append(VERSION_FIELD, canonicalVersion)
                .append(CONTENT_FIELD, content)
                .append(METADATA_FIELD, new Document());
        try {
            versionCollection.insertOne(versionDocument);
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() == ErrorCategory.DUPLICATE_KEY) {
                return false;
            }
            // Log identifying fields only — the content can be megabytes.
            LOG.error("Failed to create version [namespace={}, {}={}, version={}]",
                    namespace, idField, resourceId, canonicalVersion, e);
            throw MongoWriteFailures.toStorageWriteException(e);
        }
        incrementVersionCount(namespace, resourceId);
        return true;
    }

    /**
     * Writes a version whether or not it already exists, for the update-in-place path.
     *
     * <p>Updates {@code content} only, deliberately leaving any {@code metadata} on an
     * existing version document untouched — overwriting the whole document would
     * silently discard per-version metadata (the field reserved for document archiving).
     * Metadata is initialised to empty only when this call is the one that inserts.</p>
     *
     * <p>Because this path can <em>create</em> a version rather than only overwrite one,
     * it increments the header's {@code versionCount} when — and only when — it actually
     * inserted; otherwise the count would drift permanently low.</p>
     */
    public void upsertVersion(String namespace, int resourceId, String version, Document content) {
        // Canonical before the filter is built, so an upsert-insert derives its stored
        // version field from the canonical form via the filter's equality conditions.
        String canonicalVersion = versionScheme.canonicalise(version);
        Bson update = Updates.combine(
                Updates.set(CONTENT_FIELD, content),
                Updates.setOnInsert(METADATA_FIELD, new Document()));
        boolean inserted;
        try {
            UpdateResult result = versionCollection.updateOne(
                    versionFilter(namespace, resourceId, canonicalVersion), update, new UpdateOptions().upsert(true));
            inserted = result.getUpsertedId() != null;
        } catch (MongoWriteException e) {
            LOG.error("Failed to write version [namespace={}, {}={}, version={}]",
                    namespace, idField, resourceId, canonicalVersion, e);
            throw MongoWriteFailures.toStorageWriteException(e);
        }
        // Outside the try, matching createVersion: the count is best-effort follow-up
        // work once the version is stored, not part of the write being translated above.
        if (inserted) {
            incrementVersionCount(namespace, resourceId);
        }
    }

    /**
     * Overwrites the header's {@code name} and {@code description}.
     *
     * <p>Exists because writing a version also renames the resource: the old shape set
     * both fields in the same atomic update that wrote the version content, so the API
     * lets a version write change the display name. Preserved deliberately, including
     * the fact that a {@code null} name overwrites a real one — see the bug noted
     * against {@code ArchitectureRequest}, which validates neither field.</p>
     *
     * <p><b>Call this after the version write succeeds, never before.</b> The old shape
     * did both in one update, so a rejected create — the version already exists — left
     * the name untouched. Calling this first would rename on a request that then fails
     * with a 409, which no caller expects.</p>
     *
     * <p>Unlike {@link #incrementVersionCount}, a failure here is translated and thrown
     * rather than swallowed: this is user-supplied data, not a derived counter, so
     * silently dropping a rename is a wrong answer rather than a stale display number.
     * The cost is that the atomicity the old shape had is genuinely gone — a failure
     * here reports an error for a version that was in fact stored.</p>
     */
    public void updateHeaderDetails(String namespace, int resourceId, String name, String description) {
        try {
            UpdateResult result = headerCollection.updateOne(headerFilter(namespace, resourceId),
                    Updates.combine(Updates.set(NAME_FIELD, name), Updates.set(DESCRIPTION_FIELD, description)));
            if (result.getMatchedCount() == 0) {
                LOG.warn("No header to update details on [namespace={}, {}={}]", namespace, idField, resourceId);
            }
        } catch (MongoWriteException e) {
            LOG.error("Failed to update header details [namespace={}, {}={}]", namespace, idField, resourceId, e);
            throw MongoWriteFailures.toStorageWriteException(e);
        }
    }

    /**
     * Updates the header's {@code name} and {@code description}, ignoring either that is
     * {@code null} or blank.
     *
     * <p>The counterpart to {@link #updateHeaderDetails}, and the difference between them
     * is a real behavioural difference between resource types rather than a style choice.
     * Architecture's old shape {@code $set} both fields unconditionally, so a version write
     * carrying no name wiped the stored one; Pattern's guarded them, so it never had that
     * bug. Both are preserved exactly, which needs two operations.</p>
     *
     * <p>If both values are absent this writes nothing at all, rather than issuing an
     * update that would set two fields to the values they already hold.</p>
     */
    public void updatePresentHeaderDetails(String namespace, int resourceId, String name, String description) {
        List<Bson> updates = new ArrayList<>();
        if (isPresent(name)) {
            updates.add(Updates.set(NAME_FIELD, name));
        }
        if (isPresent(description)) {
            updates.add(Updates.set(DESCRIPTION_FIELD, description));
        }
        if (updates.isEmpty()) {
            return;
        }
        try {
            UpdateResult result = headerCollection.updateOne(
                    headerFilter(namespace, resourceId), Updates.combine(updates));
            if (result.getMatchedCount() == 0) {
                LOG.warn("No header to update details on [namespace={}, {}={}]", namespace, idField, resourceId);
            }
        } catch (MongoWriteException e) {
            LOG.error("Failed to update header details [namespace={}, {}={}]", namespace, idField, resourceId, e);
            throw MongoWriteFailures.toStorageWriteException(e);
        }
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * @return the stored content for one version, or {@code null} if that version
     * (or the resource) doesn't exist.
     */
    public Document getVersion(String namespace, int resourceId, String version) {
        Document versionDocument = versionCollection
                .find(versionFilter(namespace, resourceId, versionScheme.canonicalise(version))).first();
        return versionDocument == null ? null : versionDocument.get(CONTENT_FIELD, Document.class);
    }

    /**
     * @return every version of one resource, ordered by this store's version comparator.
     * Empty means "no versions written" — <em>not</em> "no such resource"; ask
     * {@link #headerExists} to tell those apart. Sorted in memory rather than by the
     * database because semantic ordering isn't expressible as a Mongo sort, which is
     * safe given the version count per resource is small.
     */
    public List<String> listVersions(String namespace, int resourceId) {
        List<String> versions = new ArrayList<>();
        versionCollection.find(headerFilter(namespace, resourceId))
                .projection(Projections.include(VERSION_FIELD))
                .forEach(document -> versions.add(document.getString(VERSION_FIELD)));
        versions.sort(versionScheme.order());
        return versions;
    }

    /**
     * @return the highest-ranking version of one resource, or {@code null} if it has none.
     *
     * <p>Resolved by listing and ranking in memory rather than by a database sort, because
     * the ordering is type-specific and not expressible as a Mongo sort — the stored values
     * are strings, so the database would rank {@code 10} below {@code 2}. Only the version
     * field is projected, so the cost is bounded by the number of versions, not their
     * content.</p>
     *
     * <p>Exists for ADR, whose summary and read paths are defined in terms of the latest
     * revision. ADR 0001 decided against caching a latest-version pointer on the header, so
     * this recomputes it; that decision is unchanged.</p>
     */
    public String getLatestVersion(String namespace, int resourceId) {
        List<String> versions = listVersions(namespace, resourceId);
        return versions.isEmpty() ? null : versions.get(versions.size() - 1);
    }

    /**
     * @return the content of the highest-ranking version, or {@code null} if the resource has
     * no versions. Two reads: one to rank the versions, one to fetch the winner's content.
     */
    public Document getLatestVersionContent(String namespace, int resourceId) {
        String latest = getLatestVersion(namespace, resourceId);
        return latest == null ? null : getVersion(namespace, resourceId, latest);
    }

    /**
     * Lists resource summaries for a namespace, applying the paging window at the
     * database with {@code skip}/{@code limit}.
     *
     * <p>No {@code $slice} projection is involved: that existed to page into an array
     * field inside a single shared document, and headers are now one document per
     * resource. Sorted by id so the window is stable — an unsorted Mongo query has no
     * defined order, which would make paging return overlapping or missing rows.</p>
     */
    public List<NamespaceResourceSummary> listSummariesPaged(String namespace, PageRequest page) {
        FindIterable<Document> headers = headerCollection.find(Filters.eq(NAMESPACE_FIELD, namespace))
                .sort(Sorts.ascending(idField));
        if (page.isPaged()) {
            headers = headers.skip(page.normalizedOffset()).limit(page.limit());
        }
        List<NamespaceResourceSummary> summaries = new ArrayList<>();
        headers.forEach(header -> summaries.add(toSummary(header)));
        return summaries;
    }

    private NamespaceResourceSummary toSummary(Document header) {
        Integer resourceId = header.getInteger(idField);
        String name = header.getString(NAME_FIELD);
        String description = header.getString(DESCRIPTION_FIELD);
        Integer versionCount = header.getInteger(VERSION_COUNT_FIELD);
        return new NamespaceResourceSummary(
                name == null ? resourceLabel + " " + resourceId : name,
                description == null ? "" : description,
                resourceId,
                versionCount == null ? 0 : versionCount);
    }

    /**
     * Keeps the header's denormalised {@code versionCount} in step with the version
     * collection. Best-effort by design: it is always called <em>after</em> the version
     * document is durably stored, so neither a miss nor a failed write is worth failing
     * the caller's write over.
     *
     * <p>A miss means the header is gone while its versions aren't — a real inconsistency
     * worth surfacing. A driver failure means the count write itself didn't land. Both
     * leave the same footprint ADR 0001 already accepts for a crash between the two
     * writes: the count is understated until corrected, which is a display number off by
     * one rather than lost or corrupted content.</p>
     *
     * <p>Deliberately swallows {@link MongoException} rather than translating it like the
     * version writes do. Propagating it — classified or not — would report failure for a
     * version that <em>was</em> written, and a caller retrying that "failure" would then
     * be told the version already exists.</p>
     */
    private void incrementVersionCount(String namespace, int resourceId) {
        try {
            UpdateResult result = headerCollection.updateOne(
                    headerFilter(namespace, resourceId), Updates.inc(VERSION_COUNT_FIELD, 1));
            if (result.getMatchedCount() == 0) {
                LOG.warn("Wrote a version with no matching header to count it [namespace={}, {}={}] — "
                        + "versionCount for this resource is now understated", namespace, idField, resourceId);
            }
        } catch (MongoException e) {
            LOG.warn("Failed to increment versionCount after writing a version [namespace={}, {}={}] — "
                    + "versionCount for this resource is now understated", namespace, idField, resourceId, e);
        }
    }

    private Bson headerFilter(String namespace, int resourceId) {
        return Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(idField, resourceId));
    }

    private Bson versionFilter(String namespace, int resourceId, String version) {
        return Filters.and(Filters.eq(NAMESPACE_FIELD, namespace),
                Filters.eq(idField, resourceId),
                Filters.eq(VERSION_FIELD, version));
    }
}
