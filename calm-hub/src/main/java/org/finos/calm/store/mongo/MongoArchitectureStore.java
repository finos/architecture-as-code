package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB-backed implementation of {@link ArchitectureStore}.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per architecture in {@code architectures}, and one
 * <em>version</em> document per version in {@code architectureVersions}. All document
 * handling lives in {@link MongoVersionDocumentStore}; this class only translates
 * between that and the domain's objects and exceptions. See
 * {@code calm-hub/decisions/0001-versioned-artefact-storage.md} for the shape and
 * {@code 0003-shared-version-store-helper.md} for why this composes the helper rather
 * than extending a base class.
 *
 * <p>Replaces a one-document-per-namespace shape that held every architecture and the
 * full content of every version in a single document, which grew without bound against
 * MongoDB's 16MB limit.</p>
 *
 * <h2>Existence checks</h2>
 * Every method that can report "no such architecture" asks
 * {@link MongoVersionDocumentStore#headerExists} rather than inferring it from an empty
 * version list. A header may legitimately have no versions, so the two are genuinely
 * different questions under this shape — see ADR 0003.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoArchitectureStore.class)
public class MongoArchitectureStore implements ArchitectureStore {

    private static final String HEADER_COLLECTION = "architectures";
    private static final String VERSION_COLLECTION = "architectureVersions";
    private static final String ID_FIELD = "architectureId";
    private static final String RESOURCE_LABEL = "Architecture";
    private static final String INITIAL_VERSION = "1.0.0";

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoVersionDocumentStore documentStore;

    public MongoArchitectureStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.documentStore = new MongoVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION),
                database.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
    }

    @Override
    public List<NamespaceResourceSummary> getArchitecturesForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, page);
    }

    @Override
    public Architecture createArchitectureForNamespace(Architecture architecture) throws NamespaceNotFoundException {
        requireNamespace(architecture.getNamespace());

        // Parsed before the counter is drawn and before anything is written, so malformed
        // JSON can't leave a header behind with no version to go with it.
        Document content = Document.parse(architecture.getArchitectureJson());

        int id = counterStore.getNextArchitectureSequenceValue();
        documentStore.createHeader(architecture.getNamespace(), id, architecture.getName(), architecture.getDescription());
        createInitialVersion(architecture.getNamespace(), id, content);

        return new Architecture.ArchitectureBuilder()
                .setId(id)
                .setVersion(INITIAL_VERSION)
                .setNamespace(architecture.getNamespace())
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

        Document content = documentStore.getVersion(
                architecture.getNamespace(), architecture.getId(), architecture.getDotVersion());
        if (content == null) {
            throw new ArchitectureVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public Architecture createArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException {
        requireArchitecture(architecture);

        Document content = Document.parse(architecture.getArchitectureJson());
        boolean created = documentStore.createVersion(
                architecture.getNamespace(), architecture.getId(), architecture.getDotVersion(), content);
        if (!created) {
            throw new ArchitectureVersionExistsException();
        }

        updateHeaderDetails(architecture);
        return architecture;
    }

    @Override
    public Architecture updateArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        requireArchitecture(architecture);

        Document content = Document.parse(architecture.getArchitectureJson());
        documentStore.upsertVersion(
                architecture.getNamespace(), architecture.getId(), architecture.getDotVersion(), content);

        updateHeaderDetails(architecture);
        return architecture;
    }

    /**
     * Writes the first version of a newly created architecture, removing the header again
     * if that fails.
     *
     * <p>The old shape wrote the architecture and its first version in a single document
     * push, so a failure left nothing behind. Two writes can fail between the two, and a
     * header with no versions cannot be removed through the API — there is no delete
     * endpoint — so it would sit in listings and search reporting
     * {@code versionCount: 0} indefinitely. The compensating delete keeps the failure
     * looking like the old all-or-nothing one.</p>
     *
     * <p>A {@code false} return means a version document already exists for an id the
     * counter just issued, which is a storage inconsistency rather than a normal
     * "already exists" outcome — returning the caller's payload as though it had been
     * stored would report success for content that was never written.</p>
     */
    private void createInitialVersion(String namespace, int id, Document content) {
        boolean created;
        try {
            created = documentStore.createVersion(namespace, id, INITIAL_VERSION, content);
        } catch (RuntimeException e) {
            documentStore.deleteHeader(namespace, id);
            throw e;
        }
        if (!created) {
            documentStore.deleteHeader(namespace, id);
            throw StorageWriteException.writeFailed(new IllegalStateException(
                    "Version " + INITIAL_VERSION + " already exists for newly allocated "
                            + ID_FIELD + " " + id + " in namespace " + namespace));
        }
    }

    /**
     * Applies the name and description that came with a version write. Called only
     * <em>after</em> the version write succeeds: the old shape set both fields in the
     * same conditional update that wrote the content, so a create rejected for an
     * already-existing version left them untouched.
     */
    private void updateHeaderDetails(Architecture architecture) {
        documentStore.updateHeaderDetails(architecture.getNamespace(), architecture.getId(),
                architecture.getName(), architecture.getDescription());
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }

    private void requireArchitecture(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        requireNamespace(architecture.getNamespace());
        if (!documentStore.headerExists(architecture.getNamespace(), architecture.getId())) {
            throw new ArchitectureNotFoundException();
        }
    }
}
