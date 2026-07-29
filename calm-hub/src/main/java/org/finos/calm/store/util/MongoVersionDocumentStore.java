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
 * matching the codebase's existing static-helper convention ({@link MongoUpsertPush},
 * {@code MongoResourceSlice}). The type-specific parts — the id field name, the
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

    private final MongoCollection<Document> headerCollection;
    private final MongoCollection<Document> versionCollection;
    private final String idField;
    private final String resourceLabel;

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
     * Writes a version that must not already exist.
     *
     * @return {@code false} if that version is already present — the caller decides
     * which domain exception that means. Never overwrites.
     */
    public boolean createVersion(String namespace, int resourceId, String version, Document content) {
        String canonicalVersion = CanonicalVersion.of(version);
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
        String canonicalVersion = CanonicalVersion.of(version);
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
     * @return the stored content for one version, or {@code null} if that version
     * (or the resource) doesn't exist.
     */
    public Document getVersion(String namespace, int resourceId, String version) {
        Document versionDocument = versionCollection
                .find(versionFilter(namespace, resourceId, CanonicalVersion.of(version))).first();
        return versionDocument == null ? null : versionDocument.get(CONTENT_FIELD, Document.class);
    }

    /**
     * @return every version of one resource, ordered by {@link SemanticVersionOrder}.
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
        versions.sort(SemanticVersionOrder.ASCENDING);
        return versions;
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
