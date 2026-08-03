package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB-backed implementation of {@link InterfaceStore}.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per interface in {@code interfaces}, and one <em>version</em>
 * document per version in {@code interfaceVersions}. All document handling lives in
 * {@link MongoVersionDocumentStore}.
 *
 * <p>Like Standard: version writes set name and description unconditionally, and there is no
 * update path. Unlike every other type, its listing returns {@link NamespaceInterfaceSummary},
 * which carries no version count — so the helper's summary is mapped down rather than
 * returned directly. The count is computed either way; this just doesn't expose it, which is
 * the interface's existing contract.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoInterfaceStore.class)
public class MongoInterfaceStore implements InterfaceStore {

    private static final String HEADER_COLLECTION = "interfaces";
    private static final String VERSION_COLLECTION = "interfaceVersions";
    private static final String ID_FIELD = "interfaceId";
    private static final String RESOURCE_LABEL = "Interface";
    private static final String INITIAL_VERSION = "1.0.0";

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoVersionDocumentStore documentStore;

    public MongoInterfaceStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.documentStore = new MongoVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION),
                database.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
    }

    @Override
    public List<NamespaceInterfaceSummary> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED).stream()
                .map(MongoInterfaceStore::toInterfaceSummary)
                .toList();
    }

    /** Drops the version count, which {@link NamespaceInterfaceSummary} does not carry. */
    private static NamespaceInterfaceSummary toInterfaceSummary(NamespaceResourceSummary summary) {
        return new NamespaceInterfaceSummary(summary.getName(), summary.getDescription(), summary.getId());
    }

    @Override
    public CalmInterface createInterfaceForNamespace(CreateInterfaceRequest interfaceRequest, String namespace) throws NamespaceNotFoundException {
        CalmInterface createdInterface = new CalmInterface(interfaceRequest);
        requireNamespace(namespace);

        Document content = Document.parse(interfaceRequest.getInterfaceJson());

        int id = counterStore.getNextInterfaceSequenceValue();
        documentStore.createHeader(namespace, id, interfaceRequest.getName(), interfaceRequest.getDescription());
        createInitialVersion(namespace, id, content);

        createdInterface.setId(id);
        createdInterface.setVersion(INITIAL_VERSION);
        return createdInterface;
    }

    @Override
    public List<String> getInterfaceVersions(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        requireInterface(namespace, interfaceId);
        return documentStore.listVersions(namespace, interfaceId);
    }

    @Override
    public String getInterfaceForVersion(String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionNotFoundException {
        requireInterface(namespace, interfaceId);

        Document content = documentStore.getVersion(namespace, interfaceId, version);
        if (content == null) {
            throw new InterfaceVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public CalmInterface createInterfaceForVersion(CreateInterfaceRequest interfaceRequest, String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionExistsException {
        requireInterface(namespace, interfaceId);

        Document content = Document.parse(interfaceRequest.getInterfaceJson());
        if (!documentStore.createVersion(namespace, interfaceId, version, content)) {
            throw new InterfaceVersionExistsException();
        }

        // Unconditional, matching the old shape.
        documentStore.updateHeaderDetails(namespace, interfaceId,
                interfaceRequest.getName(), interfaceRequest.getDescription());

        CalmInterface calmInterface = new CalmInterface(interfaceRequest);
        calmInterface.setId(interfaceId);
        calmInterface.setVersion(version);
        return calmInterface;
    }

    /**
     * Writes the first version of a newly created interface, removing the header again if
     * that fails — a header with no versions cannot be removed through the API.
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

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }

    private void requireInterface(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        requireNamespace(namespace);
        if (!documentStore.headerExists(namespace, interfaceId)) {
            throw new InterfaceNotFoundException();
        }
    }
}
