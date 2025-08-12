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
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the ArchitectureStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteArchitectureStore.class)
public class NitriteArchitectureStore implements ArchitectureStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteArchitectureStore.class);
    private static final String COLLECTION_NAME = "architectures";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ARCHITECTURE_ID_FIELD = "architectureId";
    private static final String ARCHITECTURES_FIELD = "architectures";
    private static final String VERSIONS_FIELD = "versions";

    private final NitriteCollection architectureCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;

    @Inject
    public NitriteArchitectureStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.architectureCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        LOG.info("NitriteArchitectureStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<Integer> getArchitecturesForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving architectures", namespace);
            throw new NamespaceNotFoundException();
        }

        TypeSafeNitriteDocument<Document> namespaceDocument = new TypeSafeNitriteDocument<>(architectureCollection.find(where(NAMESPACE_FIELD).eq(namespace)).firstOrNull(), Document.class);
        List<Document> architectures = namespaceDocument.getList(ARCHITECTURES_FIELD);
        if (architectures == null || architectures.isEmpty()) {
            return List.of();
        }

        List<Integer> architectureIds = new ArrayList<>();
        for (Document architecture : architectures) {
            architectureIds.add(architecture.get(ARCHITECTURE_ID_FIELD, Integer.class));
        }

        LOG.debug("Retrieved {} architectures for namespace '{}'", architectureIds.size(), namespace);
        return architectureIds;
    }

    @Override
    public Architecture createArchitectureForNamespace(Architecture architecture) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(architecture.getNamespace())) {
            LOG.warn("Namespace '{}' not found when creating architecture", architecture.getNamespace());
            throw new NamespaceNotFoundException();
        }

        // Validate JSON
        try {
            // Use org.bson.Document to validate JSON
            org.bson.Document.parse(architecture.getArchitectureJson());
        } catch (Exception e) {
            LOG.error("Invalid JSON format for architecture: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }

        int id = counterStore.getNextArchitectureSequenceValue();
        // Store the architecture JSON as a string
        Document architectureDocument = Document.createDocument()
                .put(ARCHITECTURE_ID_FIELD, id)
                .put(VERSIONS_FIELD, Document.createDocument()
                        .put("1-0-0", architecture.getArchitectureJson()));

        Filter filter = where(NAMESPACE_FIELD).eq(architecture.getNamespace());
        Document namespaceDoc = architectureCollection.find(filter).firstOrNull();

        if (namespaceDoc == null) {
            // Create a new namespace document with the architecture
            namespaceDoc = Document.createDocument()
                    .put(NAMESPACE_FIELD, architecture.getNamespace())
                    .put(ARCHITECTURES_FIELD, List.of(architectureDocument));
            architectureCollection.insert(namespaceDoc);
        } else {
            // Add the architecture to the existing namespace document
            List<Document> architectures = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class).getList(ARCHITECTURES_FIELD);
            if (architectures == null) {
                architectures = new ArrayList<>();
            } else {
                architectures = new ArrayList<>(architectures); // Make a mutable copy
            }
            architectures.add(architectureDocument);
            namespaceDoc.put(ARCHITECTURES_FIELD, architectures);
            architectureCollection.update(filter, namespaceDoc);
        }

        LOG.info("Created architecture with ID {} for namespace '{}'", id, architecture.getNamespace());
        return new Architecture.ArchitectureBuilder()
                .setId(id)
                .setVersion("1.0.0")
                .setNamespace(architecture.getNamespace())
                .setArchitecture(architecture.getArchitectureJson())
                .build();
    }

    @Override
    public List<String> getArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        Document result = retrieveArchitectureVersions(architecture);

        List<Document> architectures = new TypeSafeNitriteDocument<>(result, Document.class).getList(ARCHITECTURES_FIELD);
        for (Document architectureDoc : architectures) {
            if (architecture.getId() == architectureDoc.get(ARCHITECTURE_ID_FIELD, Integer.class)) {
                // Extract the versions map from the matching architecture
                Document versions = architectureDoc.get(VERSIONS_FIELD, Document.class);
                Set<String> versionKeys = versions.getFields();

                // Convert from Nitrite representation
                List<String> resourceVersions = new ArrayList<>();
                for (String versionKey : versionKeys) {
                    resourceVersions.add(versionKey.replace('-', '.'));
                }
                LOG.debug("Retrieved {} versions for architecture {} in namespace '{}'", 
                        resourceVersions.size(), architecture.getId(), architecture.getNamespace());
                return resourceVersions;
            }
        }

        LOG.warn("Architecture with ID {} not found in namespace '{}'", architecture.getId(), architecture.getNamespace());
        throw new ArchitectureNotFoundException();
    }

    private Document retrieveArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        if (!namespaceStore.namespaceExists(architecture.getNamespace())) {
            LOG.warn("Namespace '{}' not found when retrieving architecture versions", architecture.getNamespace());
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(architecture.getNamespace());
        Document result = architectureCollection.find(filter).firstOrNull();

        if (result == null) {
            LOG.warn("No architectures found for namespace '{}'", architecture.getNamespace());
            throw new ArchitectureNotFoundException();
        }

        return result;
    }

    @Override
    public String getArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionNotFoundException {
        Document result = retrieveArchitectureVersions(architecture);

        List<Document> architectures = new TypeSafeNitriteDocument<>(result, Document.class).getList(ARCHITECTURES_FIELD);
        for (Document architectureDoc : architectures) {
            if (architecture.getId() == architectureDoc.get(ARCHITECTURE_ID_FIELD, Integer.class)) {
                // Retrieve the versions map from the matching architecture
                Document versions = architectureDoc.get(VERSIONS_FIELD, Document.class);

                // Return the architecture JSON blob for the specified version
                String mongoVersion = architecture.getMongoVersion();
                Object versionObj = versions.get(mongoVersion);
                LOG.info("VersionDoc: [{}], Mongo Version: [{}]", versions, mongoVersion);

                if (versionObj == null) {
                    LOG.warn("Version '{}' not found for architecture {} in namespace '{}'", 
                            architecture.getDotVersion(), architecture.getId(), architecture.getNamespace());
                    throw new ArchitectureVersionNotFoundException();
                }

                // In NitriteDB, we're storing the JSON as a string directly
                // No need to convert to JSON string
                return (String) versionObj;
            }
        }

        // Architectures is empty, no version to find
        LOG.warn("Architecture with ID {} not found in namespace '{}'", architecture.getId(), architecture.getNamespace());
        throw new ArchitectureVersionNotFoundException();
    }

    @Override
    public Architecture createArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException {
        if (!namespaceStore.namespaceExists(architecture.getNamespace())) {
            LOG.warn("Namespace '{}' not found when creating architecture version", architecture.getNamespace());
            throw new NamespaceNotFoundException();
        }

        if (versionExists(architecture)) {
            LOG.warn("Version '{}' already exists for architecture {} in namespace '{}'", 
                    architecture.getDotVersion(), architecture.getId(), architecture.getNamespace());
            throw new ArchitectureVersionExistsException();
        }

        writeArchitectureToNitrite(architecture);
        return architecture;
    }

    @Override
    public Architecture updateArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        if (!namespaceStore.namespaceExists(architecture.getNamespace())) {
            LOG.warn("Namespace '{}' not found when updating architecture version", architecture.getNamespace());
            throw new NamespaceNotFoundException();
        }

        writeArchitectureToNitrite(architecture);
        return architecture;
    }

    private void writeArchitectureToNitrite(Architecture architecture) throws ArchitectureNotFoundException {
        try {
            // First verify the architecture exists
            retrieveArchitectureVersions(architecture);

            // Store the architecture JSON as a string directly
            // No need to parse it to a Document

            // Find the namespace document
            Filter filter = where(NAMESPACE_FIELD).eq(architecture.getNamespace());
            Document namespaceDoc = architectureCollection.find(filter).firstOrNull();

            if (namespaceDoc != null) {
                // Find the architecture document
                List<Document> architectures = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class).getList(ARCHITECTURES_FIELD);
                if (architectures != null) {
                    // Create a mutable copy of the list
                    architectures = new ArrayList<>(architectures);
                    boolean found = false;
                    for (int i = 0; i < architectures.size(); i++) {
                        Document architectureDoc = architectures.get(i);
                        if (architectureDoc.get(ARCHITECTURE_ID_FIELD, Integer.class) == architecture.getId()) {
                            // Found the architecture, update its version
                            Document versions = architectureDoc.get(VERSIONS_FIELD, Document.class);
                            versions.put(architecture.getMongoVersion(), architecture.getArchitectureJson());
                            architectureDoc.put(VERSIONS_FIELD, versions);
                            architectures.set(i, architectureDoc);
                            found = true;
                            break;
                        }
                    }

                    if (found) {
                        // Update the namespace document with the modified architectures list
                        namespaceDoc.put(ARCHITECTURES_FIELD, architectures);
                        architectureCollection.update(filter, namespaceDoc);
                        LOG.info("Updated version '{}' for architecture {} in namespace '{}'", 
                                architecture.getDotVersion(), architecture.getId(), architecture.getNamespace());
                        return;
                    }
                }
            }

            LOG.error("Failed to write architecture to Nitrite [{}]", architecture);
            throw new ArchitectureNotFoundException();
        } catch (NamespaceNotFoundException e) {
            LOG.error("Namespace not found when writing architecture to Nitrite [{}]", architecture);
            throw new ArchitectureNotFoundException();
        }
    }

    private boolean versionExists(Architecture architecture) {
        try {
            Document result = retrieveArchitectureVersions(architecture);

            List<Document> architectures = new TypeSafeNitriteDocument<>(result, Document.class).getList(ARCHITECTURES_FIELD);
            for (Document architectureDoc : architectures) {
                if (architecture.getId() == architectureDoc.get(ARCHITECTURE_ID_FIELD, Integer.class)) {
                    Document versions = architectureDoc.get(VERSIONS_FIELD, Document.class);
                    if (versions != null && versions.containsKey(architecture.getMongoVersion())) {
                        return true;  // The version already exists
                    }
                }
            }
            return false;
        } catch (NamespaceNotFoundException | ArchitectureNotFoundException e) {
            return false;
        }
    }
}
