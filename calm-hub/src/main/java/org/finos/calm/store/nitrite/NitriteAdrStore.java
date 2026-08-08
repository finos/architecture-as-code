package org.finos.calm.store.nitrite;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.finos.calm.store.util.VersionScheme;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * NitriteDB-backed implementation of {@link AdrStore}, used in standalone mode.
 *
 * <p>Mirrors {@link org.finos.calm.store.mongo.MongoAdrStore}, including the two things that
 * make ADR different from every other versioned type — integer revisions, which need
 * {@link VersionScheme#NUMERIC} so they are ordered numerically and stored verbatim, and a
 * summary built from the latest revision's content rather than from the entity. See that
 * class for why both matter.</p>
 *
 * <p>As with the other Nitrite stores, revision content is held as a JSON string rather than
 * a parsed document.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteAdrStore.class)
public class NitriteAdrStore implements AdrStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteAdrStore.class);
    private static final String HEADER_COLLECTION = "adrs";
    private static final String VERSION_COLLECTION = "adrVersions";
    private static final String ID_FIELD = "adrId";
    private static final String RESOURCE_LABEL = "ADR";

    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final NitriteVersionDocumentStore documentStore;
    private final ObjectMapper objectMapper;

    @Inject
    public NitriteAdrStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        this.documentStore = new NitriteVersionDocumentStore(
                db.getCollection(HEADER_COLLECTION),
                db.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL,
                VersionScheme.NUMERIC);
        this.objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        LOG.info("NitriteAdrStore initialized with collections: {} / {}", HEADER_COLLECTION, VERSION_COLLECTION);
    }

    @Override
    public List<NamespaceAdrSummary> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        List<NamespaceAdrSummary> summaries = new ArrayList<>();
        for (NamespaceResourceSummary header : documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED)) {
            summaries.add(toAdrSummary(namespace, header.getId()));
        }
        return summaries;
    }

    @Override
    public int countAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);
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

        String latest = documentStore.getLatestVersionContent(namespace, adrId);
        if (latest != null) {
            try {
                Adr adr = objectMapper.readValue(latest, Adr.class);
                if (adr.getTitle() != null) {
                    title = adr.getTitle();
                }
                if (adr.getStatus() != null) {
                    status = adr.getStatus().name();
                }
            } catch (JsonProcessingException e) {
                // A summary listing must not fail because one ADR's stored content is
                // unreadable — the placeholders above are exactly what the old shape showed.
                LOG.warn("Could not parse the latest revision of ADR [{}] for its summary", adrId, e);
            }
        }
        return new NamespaceAdrSummary(title, status, adrId);
    }

    @Override
    public AdrMeta createAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrParseException {
        requireNamespace(adrMeta.getNamespace());

        String content = toContent(adrMeta);

        int id = counterStore.getNextAdrSequenceValue();
        // ADRs carry no name or description of their own — both live in the revision
        // content — but the header still denormalizes a copy of the title, same as every
        // other versioned type's header carries its display name. See
        // calm-hub/decisions/0006-denormalize-adr-title-onto-header.md.
        documentStore.createHeader(adrMeta.getNamespace(), id, headerTitle(adrMeta), null);
        documentStore.createFirstVersion(adrMeta.getNamespace(), id,
                String.valueOf(adrMeta.getRevision()), content);

        LOG.info("Created ADR with ID {} for namespace '{}'", id, adrMeta.getNamespace());
        return new AdrMeta.AdrMetaBuilder(adrMeta).setId(id).build();
    }

    @Override
    public AdrMeta getAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        requireAdr(adrMeta);
        return latestRevision(adrMeta);
    }

    @Override
    public List<Integer> getAdrRevisions(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        requireAdr(adrMeta);

        List<String> revisions = documentStore.listVersions(adrMeta.getNamespace(), adrMeta.getId());
        if (revisions.isEmpty()) {
            LOG.error("Could not find any revision of ADR [{}]", adrMeta.getId());
            throw new AdrRevisionNotFoundException();
        }
        return revisions.stream().map(Integer::parseInt).toList();
    }

    @Override
    public AdrMeta getAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        requireAdr(adrMeta);

        String revision = documentStore.getVersion(
                adrMeta.getNamespace(), adrMeta.getId(), String.valueOf(adrMeta.getRevision()));
        if (revision == null) {
            LOG.warn("Revision '{}' not found for ADR {} in namespace '{}'",
                    adrMeta.getRevision(), adrMeta.getId(), adrMeta.getNamespace());
            throw new AdrRevisionNotFoundException();
        }
        return new AdrMeta.AdrMetaBuilder(adrMeta).setAdr(toAdr(revision)).build();
    }

    @Override
    public AdrMeta updateAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException {
        requireAdr(adrMeta);
        AdrMeta latest = latestRevision(adrMeta);

        AdrMeta newAdrMeta = new AdrMeta.AdrMetaBuilder(adrMeta)
                .setAdr(new Adr.AdrBuilder(adrMeta.getAdr())
                        .setStatus(latest.getAdr().getStatus())
                        .setCreationDateTime(latest.getAdr().getCreationDateTime())
                        .build())
                .setRevision(latest.getRevision() + 1)
                .build();

        writeRevision(newAdrMeta);
        return newAdrMeta;
    }

    @Override
    public AdrMeta updateAdrStatus(AdrMeta adrMeta, Status status) throws AdrNotFoundException, NamespaceNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException {
        requireAdr(adrMeta);
        AdrMeta latest = latestRevision(adrMeta);

        AdrMeta newRevision = new AdrMeta.AdrMetaBuilder(latest)
                .setRevision(latest.getRevision() + 1)
                .setAdr(new Adr.AdrBuilder(latest.getAdr()).setStatus(status).build())
                .build();

        writeRevision(newRevision);
        return newRevision;
    }

    private AdrMeta latestRevision(AdrMeta adrMeta) throws AdrRevisionNotFoundException, AdrParseException {
        String latest = documentStore.getLatestVersion(adrMeta.getNamespace(), adrMeta.getId());
        if (latest == null) {
            LOG.error("Could not find the latest revision of ADR [{}]", adrMeta.getId());
            throw new AdrRevisionNotFoundException();
        }
        String content = documentStore.getVersion(adrMeta.getNamespace(), adrMeta.getId(), latest);
        if (content == null) {
            LOG.error("Latest revision [{}] of ADR [{}] disappeared between resolving and reading it",
                    latest, adrMeta.getId());
            throw new AdrRevisionNotFoundException();
        }
        return new AdrMeta.AdrMetaBuilder()
                .setNamespace(adrMeta.getNamespace())
                .setId(adrMeta.getId())
                .setRevision(Integer.parseInt(latest))
                .setAdr(toAdr(content))
                .build();
    }


    /**
     * Writes a new revision, rejecting one that already exists — both callers compute
     * {@code latest + 1}, so two concurrent writers can arrive at the same number.
     */
    private void writeRevision(AdrMeta adrMeta) throws AdrParseException, AdrRevisionExistsException {
        String content = toContent(adrMeta);
        if (!documentStore.createVersion(adrMeta.getNamespace(), adrMeta.getId(),
                String.valueOf(adrMeta.getRevision()), content)) {
            throw new AdrRevisionExistsException();
        }
        // Refresh the header's denormalized title after the version write succeeds, never
        // before — same rule NitriteVersionDocumentStore#updateHeaderDetails documents for
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

    /**
     * ADR has no {@code validate<Type>Json} guard like its siblings, and does not need one:
     * they validate a user-supplied JSON <em>string</em>, whereas an ADR arrives as a typed
     * {@code Adr} that Jackson serialises here. The old store parsed the serialiser's own
     * output with {@code org.bson.Document.parse} as a second check; that could only fail
     * for output Jackson itself produced, so it is not carried across.
     */
    private String toContent(AdrMeta adrMeta) throws AdrParseException {
        try {
            return objectMapper.writeValueAsString(adrMeta.getAdr());
        } catch (JsonProcessingException e) {
            LOG.error("Could not write ADR Content to String", e);
            throw new AdrParseException();
        }
    }

    private Adr toAdr(String content) throws AdrParseException {
        try {
            return objectMapper.readValue(content, Adr.class);
        } catch (JsonProcessingException e) {
            LOG.error("Could not parse stored ADR to ADR Content.", e);
            throw new AdrParseException();
        }
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found", namespace);
            throw new NamespaceNotFoundException();
        }
    }

    private void requireAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException {
        requireNamespace(adrMeta.getNamespace());
        if (!documentStore.headerExists(adrMeta.getNamespace(), adrMeta.getId())) {
            LOG.warn("ADR with ID {} not found in namespace '{}'", adrMeta.getId(), adrMeta.getNamespace());
            throw new AdrNotFoundException();
        }
    }
}
