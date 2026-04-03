package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the InterfaceStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteInterfaceStore.class)
public class NitriteInterfaceStore implements InterfaceStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteInterfaceStore.class);
    private static final String COLLECTION_NAME = "interfaces";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String INTERFACE_ID_FIELD = "interfaceId";
    private static final String INTERFACES_FIELD = "interfaces";
    private static final String VERSIONS_FIELD = "versions";
    private static final String NAME_FIELD = "name";
    private static final String DESCRIPTION_FIELD = "description";

    private final NitriteCollection interfaceCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final Lock lock = new ReentrantLock();

    @Inject
    public NitriteInterfaceStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.interfaceCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        LOG.info("NitriteInterfaceStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<NamespaceInterfaceSummary> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving interfaces", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = interfaceCollection.find(filter).firstOrNull();

        if (namespaceDocument == null) {
            LOG.debug("No interfaces found for namespace '{}'", namespace);
            return List.of();
        }

        List<Document> interfaces = new TypeSafeNitriteDocument<>(namespaceDocument, Document.class).getList(INTERFACES_FIELD);
        if (interfaces == null || interfaces.isEmpty()) {
            LOG.debug("No interfaces found for namespace '{}'", namespace);
            return List.of();
        }

        List<NamespaceInterfaceSummary> namespaceInterfaceSummary = new ArrayList<>();

        for (Document interfaceDoc : interfaces) {
            NamespaceInterfaceSummary summary = new NamespaceInterfaceSummary(
                    interfaceDoc.get(NAME_FIELD, String.class),
                    interfaceDoc.get(DESCRIPTION_FIELD, String.class),
                    interfaceDoc.get(INTERFACE_ID_FIELD, Integer.class)
            );
            namespaceInterfaceSummary.add(summary);
        }

        LOG.debug("Retrieved {} interfaces for namespace '{}'", namespaceInterfaceSummary.size(), namespace);
        return namespaceInterfaceSummary;
    }

    @Override
    public CalmInterface createInterfaceForNamespace(CreateInterfaceRequest createInterfaceRequest, String namespace) throws NamespaceNotFoundException {
        CalmInterface createdInterface = new CalmInterface(createInterfaceRequest);
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when creating interface", namespace);
            throw new NamespaceNotFoundException();
        }

        try {
            org.bson.Document.parse(createInterfaceRequest.getInterfaceJson());
        } catch (Exception e) {
            LOG.error("Invalid JSON format for interface: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }

        int id = counterStore.getNextInterfaceSequenceValue();

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = interfaceCollection.find(filter).firstOrNull();

        Document interfaceDocument = Document.createDocument()
                .put(INTERFACE_ID_FIELD, id)
                .put(NAME_FIELD, createInterfaceRequest.getName())
                .put(DESCRIPTION_FIELD, createInterfaceRequest.getDescription())
                .put(VERSIONS_FIELD, Document.createDocument().put("1-0-0", createInterfaceRequest.getInterfaceJson()));

        if (namespaceDocument == null) {
            // Create new namespace document with interface
            Document newNamespaceDoc = Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace)
                    .put(INTERFACES_FIELD, List.of(interfaceDocument));

            interfaceCollection.insert(newNamespaceDoc);
        } else {
            // Update existing namespace document
            List<Document> interfaces = new TypeSafeNitriteDocument<>(namespaceDocument, Document.class).getList(INTERFACES_FIELD);
            if (interfaces == null) {
                interfaces = new ArrayList<>();
            } else {
                interfaces = new ArrayList<>(interfaces); // Create a mutable copy
            }
            interfaces.add(interfaceDocument);

            namespaceDocument.put(INTERFACES_FIELD, interfaces);
            interfaceCollection.update(filter, namespaceDocument);
        }

        createdInterface.setId(id);
        createdInterface.setVersion("1.0.0");
        createdInterface.setNamespace(namespace);
        return createdInterface;
    }

    @Override
    public List<String> getInterfaceVersions(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving interface versions", namespace);
            throw new NamespaceNotFoundException();
        }

        Document interfaceDoc = findInterfaceDocument(namespace, interfaceId);
        if (interfaceDoc == null) {
            LOG.warn("Interface with ID {} not found in namespace '{}'", interfaceId, namespace);
            throw new InterfaceNotFoundException();
        }

        Document versions = interfaceDoc.get(VERSIONS_FIELD, Document.class);
        Set<String> fieldNames = versions.getFields();
        List<String> versionList = new ArrayList<>();
        for (String fieldName : fieldNames) {
            versionList.add(fieldName.replace('-', '.'));
        }

        LOG.debug("Retrieved {} versions for interface {} in namespace '{}'",
                versionList.size(), interfaceId, namespace);
        return versionList;
    }

    @Override
    public String getInterfaceForVersion(String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document interfaceDocument = findInterfaceDocument(namespace, interfaceId);
        if (interfaceDocument == null) {
            LOG.warn("Interface with ID {} not found in namespace '{}'", interfaceId, namespace);
            throw new InterfaceNotFoundException();
        }

        Document versions = interfaceDocument.get(VERSIONS_FIELD, Document.class);
        String mongoVersion = version.replace('.', '-');
        String storedInterface = versions.get(mongoVersion, String.class);

        if (storedInterface == null) {
            LOG.warn("Version '{}' not found for interface {} in namespace '{}'",
                    mongoVersion, interfaceId, namespace);
            throw new InterfaceVersionNotFoundException();
        }

        LOG.debug("Retrieved version '{}' for interface {} in namespace '{}'",
                mongoVersion, interfaceId, namespace);

        return storedInterface;
    }

    @Override
    public CalmInterface createInterfaceForVersion(CreateInterfaceRequest interfaceRequest, String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionExistsException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        lock.lock();
        try {
            Filter namespaceFilter = where(NAMESPACE_FIELD).eq(namespace);
            Document namespaceDocument = interfaceCollection.find(namespaceFilter).firstOrNull();

            if (namespaceDocument == null) {
                LOG.warn("Namespace document for '{}' not found when creating interface version", namespace);
                throw new InterfaceNotFoundException();
            }

            Document interfaceDoc = findInterfaceDocument(namespace, interfaceId);
            if (interfaceDoc == null) {
                LOG.warn("Interface with ID {} not found in namespace '{}'", interfaceId, namespace);
                throw new InterfaceNotFoundException();
            }

            String mongoVersion = version.replace('.', '-');

            Document versions = interfaceDoc.get(VERSIONS_FIELD, Document.class);
            if (versions.containsKey(mongoVersion)) {
                LOG.warn("Version '{}' already exists for interface {} in namespace '{}'",
                        mongoVersion, interfaceId, namespace);
                throw new InterfaceVersionExistsException();
            }

            // Add the new version
            versions.put(mongoVersion, interfaceRequest.getInterfaceJson());
            interfaceDoc.put(VERSIONS_FIELD, versions);
            interfaceDoc.put(NAME_FIELD, interfaceRequest.getName());
            interfaceDoc.put(DESCRIPTION_FIELD, interfaceRequest.getDescription());

            // Update the interface in the namespace document
            List<Document> interfaces = new TypeSafeNitriteDocument<>(namespaceDocument, Document.class).getList(INTERFACES_FIELD);
            interfaces = new ArrayList<>(interfaces); // Create a mutable copy
            for (int i = 0; i < interfaces.size(); i++) {
                Document doc = interfaces.get(i);
                if (doc.get(INTERFACE_ID_FIELD, Integer.class).equals(interfaceId)) {
                    interfaces.set(i, interfaceDoc);
                    break;
                }
            }

            namespaceDocument.put(INTERFACES_FIELD, interfaces);
            interfaceCollection.update(namespaceFilter, namespaceDocument);
        } finally {
            lock.unlock();
        }

        LOG.info("Created version '{}' for interface {} in namespace '{}'",
                version.replace('.', '-'), interfaceId, namespace);

        CalmInterface calmInterface = new CalmInterface(interfaceRequest);
        calmInterface.setVersion(version);
        calmInterface.setId(interfaceId);
        calmInterface.setNamespace(namespace);
        return calmInterface;
    }

    private Document findInterfaceDocument(String namespace, Integer interfaceId) {
        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = interfaceCollection.find(filter).firstOrNull();

        if (namespaceDocument == null) {
            return null;
        }

        List<Document> interfaces = new TypeSafeNitriteDocument<>(namespaceDocument, Document.class).getList(INTERFACES_FIELD);
        if (interfaces == null) {
            return null;
        }

        for (Object iface : interfaces) {
            if (iface instanceof Document interfaceDoc) {
                Integer id = interfaceDoc.get(INTERFACE_ID_FIELD, Integer.class);
                if (id != null && id.equals(interfaceId)) {
                    return interfaceDoc;
                }
            }
        }
        return null;
    }
}
