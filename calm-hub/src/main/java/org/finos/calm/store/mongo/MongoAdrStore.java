package org.finos.calm.store.mongo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.Sorts;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.AdrSlugMapping;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.AdrSlugAllocator;
import org.finos.calm.store.util.MongoVersionDocumentStore;
import org.finos.calm.store.util.VersionScheme;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB-backed implementation of {@link AdrStore}.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per ADR in {@code adrs}, and one document per revision in
 * {@code adrVersions}. The collection follows the {@code <type>Versions} naming of ADR 0001
 * even though the domain calls these <em>revisions</em>, so the shape stays uniform across
 * all seven types; the domain's term is preserved everywhere it is user-facing.
 *
 * <h2>Why ADR needed the helpers extended</h2>
 * Two things set it apart from the other six, and both are load-bearing:
 * <ul>
 *   <li><b>Revisions are integers, not semantic versions.</b> The helper is built with
 *       {@link VersionScheme#NUMERIC}, which governs both how revisions are <em>ordered</em>
 *       and how they are <em>spelled</em>. Ordering, because the semantic comparator maps
 *       every non-semver value to {@code 0.0.0} and falls back to a string sort, ranking
 *       {@code 10} below {@code 2} and making every "latest revision" read return stale
 *       content once an ADR reached double figures. Spelling, because {@code VERSION_REGEX}
 *       treats {@code "100"} as a spelling of {@code 1.0.0}: canonicalising revisions would
 *       have rewritten revision 100 to {@code "1.0.0"}, which then sorts below {@code 99} and
 *       breaks the {@code Integer.parseInt} in {@link #getAdrRevisions}. Both halves have to
 *       agree, which is why the scheme carries them together rather than the store choosing a
 *       comparator and separately remembering a spelling rule.</li>
 *   <li><b>The summary is built from content, not from the entity.</b> Every other type reads
 *       {@code name}/{@code description}/{@code versionCount} straight off the header;
 *       {@link NamespaceAdrSummary} carries the <em>latest revision's</em> title and status.
 *       Hence {@code getLatestVersionContent}.</li>
 * </ul>
 *
 * <h2>Slug</h2>
 * Each header carries an immutable {@code slug}, the name the {@code /calm} API addresses the
 * ADR by. A partial unique index on {@code (namespace, slug)} (see
 * {@code MongoAdrSlugMigrationStep}) is the only thing that keeps slugs unique: a create
 * inserts its header with a candidate slug and, if the index refuses it, tries the next
 * suffix. There is no check-then-insert, so two concurrent creates cannot both win a slug.
 *
 * <p>Consequence worth stating: listing a namespace's ADRs is no longer one document read.
 * It is one query for the headers plus two small ones per ADR to resolve and fetch the latest
 * revision. That is more round-trips and far fewer bytes — the old single read pulled every
 * revision of every ADR in the namespace into memory, which is the growth problem this
 * redesign exists to remove.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoAdrStore.class)
public class MongoAdrStore implements AdrStore {

    private static final String HEADER_COLLECTION = "adrs";
    private static final String VERSION_COLLECTION = "adrVersions";
    private static final String ID_FIELD = "adrId";
    private static final String RESOURCE_LABEL = "ADR";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String SLUG_FIELD = "slug";

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoVersionDocumentStore documentStore;
    private final MongoCollection<Document> headerCollection;
    private final ObjectMapper objectMapper;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoAdrStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.headerCollection = database.getCollection(HEADER_COLLECTION);
        this.documentStore = new MongoVersionDocumentStore(
                headerCollection,
                database.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL,
                VersionScheme.NUMERIC);
        this.objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Override
    public List<NamespaceAdrSummary> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        Map<Integer, String> slugs = new HashMap<>();
        for (AdrSlugMapping mapping : listSlugs(namespace)) {
            slugs.put(mapping.adrId(), mapping.slug());
        }
        List<NamespaceAdrSummary> summaries = new ArrayList<>();
        for (NamespaceResourceSummary header : documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED)) {
            NamespaceAdrSummary summary = toAdrSummary(namespace, header.getId());
            summary.setSlug(slugs.get(header.getId()));
            summaries.add(summary);
        }
        return summaries;
    }

    @Override
    public int countAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return documentStore.countHeaders(namespace);
    }

    /**
     * Builds a summary from the latest revision's content, falling back to the same
     * placeholders the old shape used when an ADR has no readable revision.
     */
    private NamespaceAdrSummary toAdrSummary(String namespace, Integer adrId) {
        String title = "ADR " + adrId;
        String status = "unknown";

        // A header carrying no adrId is malformed rather than missing, and
        // listSummariesPaged deliberately renders it instead of failing — it sorts null ids
        // first for exactly that reason. Resolving its latest revision would unbox this null
        // and undo that tolerance, turning one bad document into a 500 for every ADR in the
        // namespace. Render the placeholder and move on, which is what the row is worth.
        if (adrId == null) {
            return new NamespaceAdrSummary(title, status, null);
        }

        Document latest = documentStore.getLatestVersionContent(namespace, adrId);
        if (latest != null) {
            String documentTitle = latest.getString("title");
            String documentStatus = latest.getString("status");
            if (documentTitle != null) {
                title = documentTitle;
            }
            if (documentStatus != null) {
                status = documentStatus;
            }
        }
        return new NamespaceAdrSummary(title, status, adrId);
    }

    @Override
    public AdrMeta createAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrParseException, AdrSlugExistsException {
        namespaceStore.requireNamespace(adrMeta.getNamespace());

        Document content = toContent(adrMeta);

        int id = counterStore.getNextAdrSequenceValue();
        // ADRs carry no name or description of their own — both live in the revision
        // content — but the header still denormalizes a copy of the title, same as every
        // other versioned type's header carries its display name. See
        // calm-hub/decisions/0006-denormalize-adr-title-onto-header.md.
        String slug = AdrSlugAllocator.allocate(adrMeta.getSlug(), adrMeta.getAdr().getTitle(), id,
                candidate -> documentStore.createHeaderIfUnique(adrMeta.getNamespace(), id,
                        headerTitle(adrMeta), null, Map.of(SLUG_FIELD, candidate)));
        documentStore.createFirstVersion(adrMeta.getNamespace(), id,
                String.valueOf(adrMeta.getRevision()), content);

        return new AdrMeta.AdrMetaBuilder(adrMeta).setId(id).setSlug(slug).build();
    }

    @Override
    public AdrMeta getAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        String slug = requireAdr(adrMeta);
        return new AdrMeta.AdrMetaBuilder(latestRevision(adrMeta)).setSlug(slug).build();
    }

    @Override
    public List<Integer> getAdrRevisions(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        requireAdr(adrMeta);

        List<String> revisions = documentStore.listVersions(adrMeta.getNamespace(), adrMeta.getId());
        if (revisions.isEmpty()) {
            log.error("Could not find any revision of ADR [{}]", adrMeta.getId());
            throw new AdrRevisionNotFoundException();
        }
        // Ascending, where the old shape returned incidental map-key order. Same fix applied
        // to every other type's version listing.
        return revisions.stream().map(Integer::parseInt).toList();
    }

    @Override
    public AdrMeta getAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        String slug = requireAdr(adrMeta);

        Document revision = documentStore.getVersion(
                adrMeta.getNamespace(), adrMeta.getId(), String.valueOf(adrMeta.getRevision()));
        log.info("Revision [{}] found: {}", adrMeta.getRevision(), revision != null);
        if (revision == null) {
            throw new AdrRevisionNotFoundException();
        }
        return new AdrMeta.AdrMetaBuilder(adrMeta).setSlug(slug).setAdr(toAdr(revision)).build();
    }

    @Override
    public AdrMeta updateAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException {
        return writeNextRevision(adrMeta, true);
    }

    @Override
    public AdrMeta createAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException, AdrRevisionExistsException {
        return writeNextRevision(adrMeta, false);
    }

    private AdrMeta writeNextRevision(AdrMeta adrMeta, boolean keepLatestStatus) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException, AdrRevisionExistsException {
        String slug = requireAdr(adrMeta);
        AdrMeta latest = latestRevision(adrMeta);

        Status status = keepLatestStatus || adrMeta.getAdr().getStatus() == null
                ? latest.getAdr().getStatus()
                : adrMeta.getAdr().getStatus();
        AdrMeta newAdrMeta = new AdrMeta.AdrMetaBuilder(adrMeta)
                .setSlug(slug)
                .setAdr(new Adr.AdrBuilder(adrMeta.getAdr())
                        .setStatus(status)
                        .setCreationDateTime(latest.getAdr().getCreationDateTime())
                        .build())
                .setRevision(latest.getRevision() + 1)
                .build();

        writeRevision(newAdrMeta);
        return newAdrMeta;
    }

    @Override
    public AdrMeta updateAdrStatus(AdrMeta adrMeta, Status status) throws AdrNotFoundException, NamespaceNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException {
        String slug = requireAdr(adrMeta);
        AdrMeta latest = latestRevision(adrMeta);

        AdrMeta newRevision = new AdrMeta.AdrMetaBuilder(latest)
                .setSlug(slug)
                .setRevision(latest.getRevision() + 1)
                .setAdr(new Adr.AdrBuilder(latest.getAdr()).setStatus(status).build())
                .build();

        writeRevision(newRevision);
        return newRevision;
    }

    /**
     * @return the ADR at its highest revision.
     * @throws AdrRevisionNotFoundException if it has none — an ADR always has at least one,
     *                                      so this means the data is inconsistent rather than
     *                                      that the caller asked for something missing.
     */
    private AdrMeta latestRevision(AdrMeta adrMeta) throws AdrRevisionNotFoundException, AdrParseException {
        String latest = documentStore.getLatestVersion(adrMeta.getNamespace(), adrMeta.getId());
        if (latest == null) {
            log.error("Could not find the latest revision of ADR [{}]", adrMeta.getId());
            throw new AdrRevisionNotFoundException();
        }
        Document content = documentStore.getVersion(adrMeta.getNamespace(), adrMeta.getId(), latest);
        if (content == null) {
            log.error("Latest revision [{}] of ADR [{}] disappeared between resolving and reading it",
                    latest, adrMeta.getId());
            throw new AdrRevisionNotFoundException();
        }
        log.info("Resolved latest revision: [{}]", latest);
        return new AdrMeta.AdrMetaBuilder()
                .setNamespace(adrMeta.getNamespace())
                .setId(adrMeta.getId())
                .setRevision(Integer.parseInt(latest))
                .setAdr(toAdr(content))
                .build();
    }

    /**
     * Writes a new revision, rejecting one that already exists.
     *
     * <p>Both callers compute {@code latest + 1}, so two concurrent writers can arrive at the
     * same number. The loser is told the revision exists rather than silently overwriting the
     * winner — the same guarantee the old shape's conditional update gave.</p>
     */
    private void writeRevision(AdrMeta adrMeta) throws AdrParseException, AdrRevisionExistsException {
        Document content = toContent(adrMeta);
        if (!documentStore.createVersion(adrMeta.getNamespace(), adrMeta.getId(),
                String.valueOf(adrMeta.getRevision()), content)) {
            throw new AdrRevisionExistsException();
        }
        // Refresh the header's denormalized title after the version write succeeds, never
        // before — same rule MongoVersionDocumentStore#updateHeaderDetails documents for
        // every other type. updatePresentHeaderDetails deliberately no-ops on a blank title,
        // so a revision that omits one leaves the header's existing title standing rather
        // than overwriting it with a placeholder.
        documentStore.updatePresentHeaderDetails(adrMeta.getNamespace(), adrMeta.getId(),
                adrMeta.getAdr().getTitle(), null);
    }

    /**
     * Resolves the title to denormalize onto a brand-new header, falling back to a
     * placeholder rather than leaving it blank — unlike a later revision, there is no
     * existing header title a blank one could instead leave standing.
     */
    private String headerTitle(AdrMeta adrMeta) {
        String title = adrMeta.getAdr().getTitle();
        return title == null || title.isBlank() ? "Untitled ADR" : title;
    }

    private Document toContent(AdrMeta adrMeta) throws AdrParseException {
        try {
            return Document.parse(objectMapper.writeValueAsString(adrMeta.getAdr()));
        } catch (JsonProcessingException e) {
            log.error("Could not write ADR Content to String", e);
            throw new AdrParseException();
        }
    }

    private Adr toAdr(Document content) throws AdrParseException {
        try {
            return objectMapper.readValue(content.toJson(), Adr.class);
        } catch (JsonProcessingException e) {
            log.error("Could not parse stored ADR to ADR Content.", e);
            throw new AdrParseException();
        }
    }

    /**
     * @return the ADR's slug, or {@code null} for a header the slug migration has not reached
     * @throws AdrNotFoundException if the ADR does not exist
     */
    private String requireAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException {
        namespaceStore.requireNamespace(adrMeta.getNamespace());
        Document header = headerCollection.find(Filters.and(
                        Filters.eq(NAMESPACE_FIELD, adrMeta.getNamespace()), Filters.eq(ID_FIELD, adrMeta.getId())))
                .projection(Projections.include(SLUG_FIELD))
                .first();
        if (header == null) {
            throw new AdrNotFoundException();
        }
        return header.getString(SLUG_FIELD);
    }

    @Override
    public int getAdrIdBySlug(String namespace, String slug) throws NamespaceNotFoundException, AdrNotFoundException {
        namespaceStore.requireNamespace(namespace);
        Document header = headerCollection.find(Filters.and(
                        Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(SLUG_FIELD, slug)))
                .projection(Projections.include(ID_FIELD))
                .first();
        if (header == null || header.getInteger(ID_FIELD) == null) {
            throw new AdrNotFoundException();
        }
        return header.getInteger(ID_FIELD);
    }

    @Override
    public List<AdrSlugMapping> getAdrSlugs(String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return listSlugs(namespace);
    }

    private List<AdrSlugMapping> listSlugs(String namespace) {
        List<AdrSlugMapping> slugs = new ArrayList<>();
        headerCollection.find(Filters.eq(NAMESPACE_FIELD, namespace))
                .projection(Projections.include(ID_FIELD, SLUG_FIELD))
                .sort(Sorts.ascending(ID_FIELD))
                .forEach(header -> {
                    String slug = header.getString(SLUG_FIELD);
                    Integer adrId = header.getInteger(ID_FIELD);
                    if (slug != null && adrId != null) {
                        slugs.add(new AdrSlugMapping(slug, adrId));
                    }
                });
        return slugs;
    }

    @Override
    public void deleteAdr(String namespace, int adrId) throws NamespaceNotFoundException, AdrNotFoundException {
        namespaceStore.requireNamespace(namespace);
        if (!documentStore.deleteResource(namespace, adrId)) {
            throw new AdrNotFoundException();
        }
    }
}
