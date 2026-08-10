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
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.MongoVersionDocumentStore.INITIAL_VERSION;

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
        namespaceStore.requireNamespace(namespace);
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
        namespaceStore.requireNamespace(namespace);

        Document content = Document.parse(interfaceRequest.getInterfaceJson());

        int id = counterStore.getNextInterfaceSequenceValue();
        documentStore.createHeader(namespace, id, interfaceRequest.getName(), interfaceRequest.getDescription());
        documentStore.createFirstVersion(namespace, id, content);

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

    private void requireInterface(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        if (!documentStore.headerExists(namespace, interfaceId)) {
            throw new InterfaceNotFoundException();
        }
    }
}
