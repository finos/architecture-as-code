package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
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
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.NitriteVersionDocumentStore.INITIAL_VERSION;

/**
 * NitriteDB-backed implementation of {@link InterfaceStore}, used in standalone mode.
 * Mirrors {@link org.finos.calm.store.mongo.MongoInterfaceStore}: content held as a JSON
 * string, name and description set unconditionally on a version write, no update path, and
 * the helper's summary mapped down to {@link NamespaceInterfaceSummary}, which carries no
 * version count.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteInterfaceStore.class)
public class NitriteInterfaceStore implements InterfaceStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteInterfaceStore.class);
    private static final String HEADER_COLLECTION = "interfaces";
    private static final String VERSION_COLLECTION = "interfaceVersions";
    private static final String ID_FIELD = "interfaceId";
    private static final String RESOURCE_LABEL = "Interface";

    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final NitriteVersionDocumentStore documentStore;

    @Inject
    public NitriteInterfaceStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        this.documentStore = new NitriteVersionDocumentStore(
                db.getCollection(HEADER_COLLECTION),
                db.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
        LOG.info("NitriteInterfaceStore initialized with collections: {} / {}", HEADER_COLLECTION, VERSION_COLLECTION);
    }

    @Override
    public List<NamespaceInterfaceSummary> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED).stream()
                .map(NitriteInterfaceStore::toInterfaceSummary)
                .toList();
    }

    /** Drops the version count, which {@link NamespaceInterfaceSummary} does not carry. */
    private static NamespaceInterfaceSummary toInterfaceSummary(NamespaceResourceSummary summary) {
        return new NamespaceInterfaceSummary(summary.getName(), summary.getDescription(), summary.getId());
    }

    @Override
    public CalmInterface createInterfaceForNamespace(CreateInterfaceRequest createInterfaceRequest, String namespace) throws NamespaceNotFoundException {
        CalmInterface createdInterface = new CalmInterface(createInterfaceRequest);
        namespaceStore.requireNamespace(namespace);
        validateInterfaceJson(createInterfaceRequest.getInterfaceJson());

        int id = counterStore.getNextInterfaceSequenceValue();
        documentStore.createHeader(namespace, id, createInterfaceRequest.getName(), createInterfaceRequest.getDescription());
        documentStore.createFirstVersion(namespace, id, createInterfaceRequest.getInterfaceJson());

        LOG.info("Created interface with ID {} for namespace '{}'", id, namespace);
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

        String content = documentStore.getVersion(namespace, interfaceId, version);
        if (content == null) {
            LOG.warn("Version '{}' not found for interface {} in namespace '{}'", version, interfaceId, namespace);
            throw new InterfaceVersionNotFoundException();
        }
        return content;
    }

    @Override
    public CalmInterface createInterfaceForVersion(CreateInterfaceRequest interfaceRequest, String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionExistsException {
        namespaceStore.requireNamespace(namespace);
        validateInterfaceJson(interfaceRequest.getInterfaceJson());
        requireInterfaceExists(namespace, interfaceId);

        if (!documentStore.createVersion(namespace, interfaceId, version, interfaceRequest.getInterfaceJson())) {
            LOG.warn("Version '{}' already exists for interface {} in namespace '{}'", version, interfaceId, namespace);
            throw new InterfaceVersionExistsException();
        }

        // Unconditional, matching the old shape.
        documentStore.updateHeaderDetails(namespace, interfaceId,
                interfaceRequest.getName(), interfaceRequest.getDescription());

        LOG.info("Created version '{}' for interface {} in namespace '{}'", version, interfaceId, namespace);
        CalmInterface calmInterface = new CalmInterface(interfaceRequest);
        calmInterface.setId(interfaceId);
        calmInterface.setVersion(version);
        return calmInterface;
    }

    /**
     * Validates that the supplied interface JSON is parseable, throwing
     * {@link JsonParseException} if not so the REST layer can surface a 400.
     */
    private void validateInterfaceJson(String interfaceJson) {
        if (interfaceJson == null) {
            LOG.error("Interface JSON must not be null");
            throw new JsonParseException("Interface JSON must not be null");
        }
        try {
            org.bson.Document.parse(interfaceJson);
        } catch (Exception e) {
            LOG.error("Invalid JSON format for interface: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }
    }

    private void requireInterfaceExists(String namespace, Integer interfaceId) throws InterfaceNotFoundException {
        if (!documentStore.headerExists(namespace, interfaceId)) {
            LOG.warn("Interface with ID {} not found in namespace '{}'", interfaceId, namespace);
            throw new InterfaceNotFoundException();
        }
    }

    private void requireInterface(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        requireInterfaceExists(namespace, interfaceId);
    }

    @Override
    public void deleteInterface(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        if (!documentStore.deleteResource(namespace, interfaceId)) {
            throw new InterfaceNotFoundException();
        }
        LOG.info("Deleted interface with ID {} from namespace '{}'", interfaceId, namespace);
    }
}
