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
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.StandardDetails;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.store.StandardStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the StandardStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteStandardStore.class)
public class NitriteStandardStore implements StandardStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteStandardStore.class);
    private static final String COLLECTION_NAME = "standards";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String STANDARD_ID_FIELD = "standardId";
    private static final String STANDARDS_FIELD = "standards";
    private static final String VERSIONS_FIELD = "versions";
    private static final String NAME_FIELD = "name";
    private static final String DESCRIPTION_FIELD = "description";

    private final NitriteCollection standardCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;

    @Inject
    public NitriteStandardStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.standardCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        LOG.info("NitriteStandardStore initialized with collection: {}", COLLECTION_NAME);
    }


    @Override
    public List<StandardDetails> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving standards", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Iterator<Document> namespaceIterator = standardCollection.find(filter).iterator();

        // If no standards exist for this namespace yet
        if (!namespaceIterator.hasNext()) {
            LOG.debug("No standards found for namespace '{}'", namespace);
            return List.of();
        }

        List<StandardDetails> standardDetails = new ArrayList<>();

        while (namespaceIterator.hasNext()) {
            StandardDetails details = new StandardDetails();
            Document standard = namespaceIterator.next();
            details.setName(standard.get(NAME_FIELD, String.class));
            details.setDescription(standard.get(DESCRIPTION_FIELD, String.class));
            details.setId(standard.get(STANDARD_ID_FIELD, Integer.class));
            standardDetails.add(details);
        }

        LOG.debug("Retrieved {} standards for namespace '{}'", standardDetails.size(), namespace);
        return standardDetails;
    }

    @Override
    public Standard createStandardForNamespace(Standard standard) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(standard.getNamespace())) {
            LOG.warn("Namespace '{}' not found when creating standard", standard.getNamespace());
            throw new NamespaceNotFoundException();
        }

        try {
            // Validate JSON by attempting to parse it
            org.bson.Document.parse(standard.getStandardJson());
        } catch (Exception e) {
            LOG.error("Invalid JSON format for standard: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }

        int id = counterStore.getNextStandardSequenceValue();

        Filter filter = where(NAMESPACE_FIELD).eq(standard.getNamespace());
        Document namespaceDocument = standardCollection.find(filter).firstOrNull();

        Document standardDocument = Document.createDocument()
                .put(STANDARD_ID_FIELD, id)
                .put(NAME_FIELD, standard.getName())
                .put(DESCRIPTION_FIELD, standard.getName())
                .put(VERSIONS_FIELD, Document.createDocument().put("1-0-0", standard.getStandardJson()));

        if (namespaceDocument == null) {
            // Create new namespace document with standard
            Document newNamespaceDoc = Document.createDocument()
                    .put(NAMESPACE_FIELD, standard.getNamespace())
                    .put(STANDARDS_FIELD, List.of(standardDocument));

            standardCollection.insert(newNamespaceDoc);
        } else {
            // Update existing namespace document
            List<Document> standards = namespaceDocument.get(STANDARDS_FIELD, List.class);
            if (standards == null) {
                standards = new ArrayList<>();
            } else {
                standards = new ArrayList<>(standards); // Make a mutable copy
            }
            standards.add(standardDocument);

            namespaceDocument.put(STANDARDS_FIELD, standards);
            standardCollection.update(filter, namespaceDocument);
        }

        standard.setId(id);
        standard.setVersion("1.0.0");
        return standard;
    }

    @Override
    public List<String> getStandardVersions(StandardDetails standard) throws NamespaceNotFoundException, StandardNotFoundException {
        if (!namespaceStore.namespaceExists(standard.getNamespace())) {
            LOG.warn("Namespace '{}' not found when retrieving standard versions", standard.getNamespace());
            throw new NamespaceNotFoundException();
        }

        Document standardDoc = findStandardDocument(standard);
        if (standardDoc == null) {
            LOG.warn("Standard with ID {} not found in namespace '{}'", standard.getId(), standard.getNamespace());
            throw new StandardNotFoundException();
        }

        Document versions = standardDoc.get(VERSIONS_FIELD, Document.class);
        // In NitriteDB, we need to get the field names directly
        Set<String> fieldNames = versions.getFields();
        List<String> versionList = new ArrayList<>(fieldNames);

        LOG.debug("Retrieved {} versions for standard {} in namespace '{}'",
                versionList.size(), standard.getId(), standard.getNamespace());
        return versionList;
    }

    @Override
    public String getStandardForVersion(StandardDetails standardDetails) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException {
        if(!namespaceStore.namespaceExists(standardDetails.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        Document standardDocument = findStandardDocument(standardDetails);
        if (standardDocument == null) {
            LOG.warn("Standard with ID {} not found in namespace '{}'", standardDetails.getId(), standardDetails.getNamespace());
            throw new StandardNotFoundException();
        }

        Document versions = standardDocument.get(VERSIONS_FIELD, Document.class);
        String standardJson = versions.get(standardDetails.getMongoVersion(), String.class);

        if (standardJson == null) {
            LOG.warn("Version '{}' not found for standard {} in namespace '{}'",
                    standardDetails.getMongoVersion(), standardDetails.getId(), standardDetails.getNamespace());
            throw new StandardVersionNotFoundException();
        }

        LOG.debug("Retrieved version '{}' for standard {} in namespace '{}'",
                standardDetails.getMongoVersion(), standardDetails.getId(), standardDetails.getNamespace());
        return standardJson;
    }

    @Override
    public Standard createStandardForVersion(Standard standard) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        if(!namespaceStore.namespaceExists(standard.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        Filter namespaceFilter = where(NAMESPACE_FIELD).eq(standard.getNamespace());
        Document namespaceDocument = standardCollection.find(namespaceFilter).firstOrNull();

        if (namespaceDocument == null) {
            LOG.warn("Namespace document for '{}' not found when creating standard version", standard.getNamespace());
            throw new StandardNotFoundException();
        }

        Document standardDoc = findStandardDocument(standard);
        if (standardDoc == null) {
            LOG.warn("Standard with ID {} not found in namespace '{}'", standard.getId(), standard.getNamespace());
            throw new StandardNotFoundException();
        }

        Document versions = standardDoc.get(VERSIONS_FIELD, Document.class);
        if (versions.containsKey(standard.getMongoVersion())) {
            LOG.warn("Version '{}' already exists for standard {} in namespace '{}'",
                    standard.getMongoVersion(), standard.getId(), standard.getNamespace());
            throw new StandardVersionExistsException();
        }

        // Add the new version
        versions.put(standard.getMongoVersion(), standard.getStandardJson());
        standardDoc.put(VERSIONS_FIELD, versions);

        // Update the standard in the namespace document
        List<Document> standards = namespaceDocument.get(STANDARDS_FIELD, List.class);
        // Create a mutable copy of the list
        standards = new ArrayList<>(standards);
        for (int i = 0; i < standards.size(); i++) {
            Document doc = standards.get(i);
            if (doc.get(STANDARD_ID_FIELD, Integer.class).equals(standard.getId())) {
                standards.set(i, standardDoc);
                break;
            }
        }

        namespaceDocument.put(STANDARDS_FIELD, standards);
        standardCollection.update(namespaceFilter, namespaceDocument);

        LOG.info("Created version '{}' for standard {} in namespace '{}'",
                standard.getMongoVersion(), standard.getId(), standard.getNamespace());
        return standard;

    }

    private Document findStandardDocument(StandardDetails standardDetails) {
        Filter filter = where(NAMESPACE_FIELD).eq(standardDetails.getNamespace());
        Document namespaceDocument = standardCollection.find(filter).firstOrNull();

        if (namespaceDocument == null) {
            return null;
        }

        List<Document> standards = namespaceDocument.get(STANDARDS_FIELD, List.class);
        if (standards == null) {
            return null;
        }

        for (Object standard : standards) {
            if (standard instanceof Document standardDoc) {
                Integer id = standardDoc.get(STANDARD_ID_FIELD, Integer.class);
                if (id != null && id.equals(standardDetails.getId())) {
                    return standardDoc;
                }
            }
        }

        return null;
    }
}
