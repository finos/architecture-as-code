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
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.standards.NamespaceStandardSummary;
import org.finos.calm.store.StandardStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
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
    public List<NamespaceStandardSummary> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving standards", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = standardCollection.find(filter).firstOrNull();

        // If no standards exist for this namespace yet
        if (namespaceDocument == null) {
            LOG.debug("No standards found for namespace '{}'", namespace);
            return List.of();
        }

        List<Document> standards = namespaceDocument.get(STANDARDS_FIELD, List.class);
        if (standards == null || standards.isEmpty()) {
            LOG.debug("No standards found for namespace '{}'", namespace);
            return List.of();
        }

        List<NamespaceStandardSummary> namespaceStandardSummary = new ArrayList<>();

        for (Document standard : standards) {
            NamespaceStandardSummary summary = new NamespaceStandardSummary(
                    standard.get(NAME_FIELD, String.class),
                    standard.get(DESCRIPTION_FIELD, String.class),
                    standard.get(STANDARD_ID_FIELD, Integer.class)
            );
            namespaceStandardSummary.add(summary);
        }

        LOG.debug("Retrieved {} standards for namespace '{}'", namespaceStandardSummary.size(), namespace);
        return namespaceStandardSummary;
    }

    @Override
    public Standard createStandardForNamespace(CreateStandardRequest createStandardRequest, String namespace) throws NamespaceNotFoundException {
        Standard createdStandard = new Standard(createStandardRequest);
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when creating standard", namespace);
            throw new NamespaceNotFoundException();
        }

        try {
            // Validate JSON by attempting to parse it
            org.bson.Document.parse(createStandardRequest.getStandardJson());
        } catch (Exception e) {
            LOG.error("Invalid JSON format for standard: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }

        int id = counterStore.getNextStandardSequenceValue();

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = standardCollection.find(filter).firstOrNull();

        Document standardDocument = Document.createDocument()
                .put(STANDARD_ID_FIELD, id)
                .put(NAME_FIELD, createStandardRequest.getName())
                .put(DESCRIPTION_FIELD, createStandardRequest.getDescription())
                .put(VERSIONS_FIELD, Document.createDocument().put("1-0-0", createStandardRequest.getStandardJson()));

        if (namespaceDocument == null) {
            // Create new namespace document with standard
            Document newNamespaceDoc = Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace)
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

        createdStandard.setId(id);
        createdStandard.setVersion("1.0.0");
        return createdStandard;
    }

    @Override
    public List<String> getStandardVersions(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving standard versions", namespace);
            throw new NamespaceNotFoundException();
        }

        Document standardDoc = findStandardDocument(namespace, standardId);
        if (standardDoc == null) {
            LOG.warn("Standard with ID {} not found in namespace '{}'", standardId, namespace);
            throw new StandardNotFoundException();
        }

        Document versions = standardDoc.get(VERSIONS_FIELD, Document.class);
        // In NitriteDB, we need to get the field names directly
        Set<String> fieldNames = versions.getFields();
        List<String> versionList = new ArrayList<>(fieldNames);

        LOG.debug("Retrieved {} versions for standard {} in namespace '{}'",
                versionList.size(), standardId, namespace);
        return versionList;
    }

    @Override
    public Standard getStandardForVersion(String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document standardDocument = findStandardDocument(namespace, standardId);
        if (standardDocument == null) {
            LOG.warn("Standard with ID {} not found in namespace '{}'", standardId, namespace);
            throw new StandardNotFoundException();
        }

        Document versions = standardDocument.get(VERSIONS_FIELD, Document.class);
        String mongoVersion = version.replace('.', '-');
        String standardJson = versions.get(mongoVersion, String.class);

        if (standardJson == null) {
            LOG.warn("Version '{}' not found for standard {} in namespace '{}'",
                    mongoVersion, standardId, namespace);
            throw new StandardVersionNotFoundException();
        }

        LOG.debug("Retrieved version '{}' for standard {} in namespace '{}'",
                mongoVersion, standardId, namespace);

        //FIXME will need to return an actual standard
        return new Standard();
    }

    @Override
    public Standard createStandardForVersion(CreateStandardRequest standardRequest, String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Filter namespaceFilter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = standardCollection.find(namespaceFilter).firstOrNull();

        if (namespaceDocument == null) {
            LOG.warn("Namespace document for '{}' not found when creating standard version", namespace);
            throw new StandardNotFoundException();
        }

        Document standardDoc = findStandardDocument(namespace, standardId);
        if (standardDoc == null) {
            LOG.warn("Standard with ID {} not found in namespace '{}'", standardId, namespace);
            throw new StandardNotFoundException();
        }

        String mongoVersion = version.replace('.','-');

        Document versions = standardDoc.get(VERSIONS_FIELD, Document.class);
        if (versions.containsKey(mongoVersion)) {
            LOG.warn("Version '{}' already exists for standard {} in namespace '{}'",
                    mongoVersion, standardId, namespace);
            throw new StandardVersionExistsException();
        }

        // Add the new version
        versions.put(mongoVersion, standardRequest.getStandardJson());
        standardDoc.put(VERSIONS_FIELD, versions);
        standardDoc.put(NAME_FIELD, standardRequest.getName());
        standardDoc.put(DESCRIPTION_FIELD, standardRequest.getDescription());

        // Update the standard in the namespace document
        List<Document> standards = namespaceDocument.get(STANDARDS_FIELD, List.class);
        // Create a mutable copy of the list
        standards = new ArrayList<>(standards);
        for (int i = 0; i < standards.size(); i++) {
            Document doc = standards.get(i);
            if (doc.get(STANDARD_ID_FIELD, Integer.class).equals(standardId)) {
                standards.set(i, standardDoc);
                break;
            }
        }

        namespaceDocument.put(STANDARDS_FIELD, standards);
        standardCollection.update(namespaceFilter, namespaceDocument);

        LOG.info("Created version '{}' for standard {} in namespace '{}'",
                mongoVersion, standardId, namespace);

        Standard standard = new Standard(standardRequest);
        standard.setVersion(version);
        standard.setId(standardId);
        standard.setNamespace(namespace);
        return standard;

    }

    private Document findStandardDocument(String namespace, Integer standardId) {
        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
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
                if (id != null && id.equals(standardId)) {
                    return standardDoc;
                }
            }
        }

        return null;
    }
}
