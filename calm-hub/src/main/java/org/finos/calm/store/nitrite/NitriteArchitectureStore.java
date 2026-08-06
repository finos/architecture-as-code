package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.NitriteVersionDocumentStore.INITIAL_VERSION;

/**
 * NitriteDB-backed implementation of {@link ArchitectureStore}, used in standalone mode.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per architecture in {@code architectures}, and one
 * <em>version</em> document per version in {@code architectureVersions}, mirroring
 * {@link org.finos.calm.store.mongo.MongoArchitectureStore}. All document handling and
 * locking live in {@link NitriteVersionDocumentStore}; this class only translates
 * between that and the domain's objects and exceptions.
 *
 * <p>Two differences from the Mongo implementation are deliberate rather than
 * incidental, and both predate this shape:</p>
 * <ul>
 *   <li><b>Content is stored as a JSON string</b>, not a parsed document, matching the
 *       other Nitrite stores.</li>
 *   <li><b>JSON is validated up front</b> by {@link #validateArchitectureJson}, before
 *       the architecture's existence is checked — so a request that is both malformed
 *       and aimed at a missing architecture reports the parse failure here and the
 *       missing architecture on Mongo. Preserved as-is; changing it is a behaviour
 *       change rather than part of moving to the new shape.</li>
 * </ul>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteArchitectureStore.class)
public class NitriteArchitectureStore implements ArchitectureStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteArchitectureStore.class);
    private static final String HEADER_COLLECTION = "architectures";
    private static final String VERSION_COLLECTION = "architectureVersions";
    private static final String ID_FIELD = "architectureId";
    private static final String RESOURCE_LABEL = "Architecture";

    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final NitriteVersionDocumentStore documentStore;

    @Inject
    public NitriteArchitectureStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        this.documentStore = new NitriteVersionDocumentStore(
                db.getCollection(HEADER_COLLECTION),
                db.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
        LOG.info("NitriteArchitectureStore initialized with collections: {} / {}", HEADER_COLLECTION, VERSION_COLLECTION);
    }

    @Override
    public List<NamespaceResourceSummary> getArchitecturesForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, page);
    }

    @Override
    public boolean architectureExists(String namespace, int architectureId) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        return documentStore.headerExists(namespace, architectureId);
    }

    @Override
    public Architecture createArchitectureForNamespace(Architecture architecture) throws NamespaceNotFoundException {
        requireNamespace(architecture.getNamespace());
        validateArchitectureJson(architecture.getArchitectureJson());

        int id = counterStore.getNextArchitectureSequenceValue();
        documentStore.createHeader(architecture.getNamespace(), id, architecture.getName(), architecture.getDescription());
        documentStore.createFirstVersion(architecture.getNamespace(), id, architecture.getArchitectureJson());

        LOG.info("Created architecture with ID {} for namespace '{}'", id, architecture.getNamespace());
        return new Architecture.ArchitectureBuilder()
                .setId(id)
                .setVersion(INITIAL_VERSION)
                .setNamespace(architecture.getNamespace())
                .setName(architecture.getName())
                .setDescription(architecture.getDescription())
                .setArchitecture(architecture.getArchitectureJson())
                .build();
    }

    @Override
    public List<String> getArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        requireArchitecture(architecture);
        // An architecture with no versions yet returns an empty list rather than
        // reporting itself missing — the header above already settled that question.
        return documentStore.listVersions(architecture.getNamespace(), architecture.getId());
    }

    @Override
    public String getArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionNotFoundException {
        requireArchitecture(architecture);

        String content = documentStore.getVersion(
                architecture.getNamespace(), architecture.getId(), architecture.getDotVersion());
        if (content == null) {
            LOG.warn("Version '{}' not found for architecture {} in namespace '{}'",
                    architecture.getDotVersion(), architecture.getId(), architecture.getNamespace());
            throw new ArchitectureVersionNotFoundException();
        }
        return content;
    }

    @Override
    public Architecture createArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException {
        requireNamespace(architecture.getNamespace());
        validateArchitectureJson(architecture.getArchitectureJson());
        requireArchitectureExists(architecture);

        boolean created = documentStore.createVersion(architecture.getNamespace(), architecture.getId(),
                architecture.getDotVersion(), architecture.getArchitectureJson());
        if (!created) {
            LOG.warn("Version '{}' already exists for architecture {} in namespace '{}'",
                    architecture.getDotVersion(), architecture.getId(), architecture.getNamespace());
            throw new ArchitectureVersionExistsException();
        }

        updateHeaderDetails(architecture);
        return architecture;
    }

    @Override
    public Architecture updateArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        requireNamespace(architecture.getNamespace());
        validateArchitectureJson(architecture.getArchitectureJson());
        requireArchitectureExists(architecture);

        documentStore.upsertVersion(architecture.getNamespace(), architecture.getId(),
                architecture.getDotVersion(), architecture.getArchitectureJson());

        updateHeaderDetails(architecture);
        return architecture;
    }

    /**
     * Validates that the supplied architecture JSON is parseable, throwing {@link JsonParseException} if not so the
     * REST layer can surface a 400. Validation runs immediately after the namespace check, before any existence or
     * version checks, so a malformed payload is rejected consistently regardless of the operation.
     *
     * @param architectureJson the raw architecture JSON to validate
     */
    private void validateArchitectureJson(String architectureJson) {
        if (architectureJson == null) {
            LOG.error("Architecture JSON must not be null");
            throw new JsonParseException("Architecture JSON must not be null");
        }
        try {
            // Use org.bson.Document to validate JSON
            org.bson.Document.parse(architectureJson);
        } catch (JsonParseException e) {
            // Rethrow the original so the parse failure's stack trace is preserved for observability
            LOG.error("Invalid JSON format for architecture: {}", e.getMessage());
            throw e;
        }
    }


    /**
     * Applies the name and description that came with a version write. Called only
     * <em>after</em> the version write succeeds, matching the Mongo implementation —
     * see {@code MongoVersionDocumentStore.updateHeaderDetails} for why the ordering
     * matters.
     */
    private void updateHeaderDetails(Architecture architecture) {
        documentStore.updateHeaderDetails(architecture.getNamespace(), architecture.getId(),
                architecture.getName(), architecture.getDescription());
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found", namespace);
            throw new NamespaceNotFoundException();
        }
    }

    private void requireArchitectureExists(Architecture architecture) throws ArchitectureNotFoundException {
        if (!documentStore.headerExists(architecture.getNamespace(), architecture.getId())) {
            LOG.warn("Architecture with ID {} not found in namespace '{}'", architecture.getId(), architecture.getNamespace());
            throw new ArchitectureNotFoundException();
        }
    }

    private void requireArchitecture(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        requireNamespace(architecture.getNamespace());
        requireArchitectureExists(architecture);
    }
}
