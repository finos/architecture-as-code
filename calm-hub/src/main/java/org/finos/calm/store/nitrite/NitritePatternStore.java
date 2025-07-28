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
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.patterns.CreatePatternRequest;
import org.finos.calm.store.PatternStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the PatternStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitritePatternStore.class)
public class NitritePatternStore implements PatternStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitritePatternStore.class);
    private static final String COLLECTION_NAME = "patterns";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String PATTERN_ID_FIELD = "patternId";
    private static final String PATTERNS_FIELD = "patterns";
    private static final String VERSIONS_FIELD = "versions";
    private static final String JSON_FIELD = "patternJson";

    private final NitriteCollection patternCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;

    @Inject
    public NitritePatternStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.patternCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        LOG.info("NitritePatternStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<Integer> getPatternsForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving patterns", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = patternCollection.find(filter).firstOrNull();

        // If no patterns exist for this namespace yet
        if (namespaceDocument == null) {
            LOG.debug("No patterns found for namespace '{}'", namespace);
            return List.of();
        }

        List<Integer> patternIds = new ArrayList<>();
        // Get patterns list with proper type handling
        List<Object> rawPatterns = namespaceDocument.get(PATTERNS_FIELD, List.class);

        if (rawPatterns != null) {
            for (Object patternObj : rawPatterns) {
                if (patternObj instanceof Document patternDoc) {
                    Integer patternId = patternDoc.get(PATTERN_ID_FIELD, Integer.class);
                    if (patternId != null) {
                        patternIds.add(patternId);
                    }
                }
            }
        }

        LOG.debug("Retrieved {} patterns for namespace '{}'", patternIds.size(), namespace);
        return patternIds;
    }

    @Override
    public Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException, JsonParseException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        try {
            // Validate JSON by attempting to parse it
            org.bson.Document.parse(patternRequest.getPatternJson());
        } catch (Exception e) {
            LOG.error("Invalid JSON format for pattern: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }

        int id = counterStore.getNextPatternSequenceValue();

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = patternCollection.find(filter).firstOrNull();

        Document patternDocument = Document.createDocument()
                .put(PATTERN_ID_FIELD, id)
                .put(VERSIONS_FIELD, Document.createDocument().put("1-0-0", patternRequest.getPatternJson()));

        if (namespaceDocument == null) {
            // Create new namespace document with pattern
            Document newNamespaceDoc = Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace)
                    .put(PATTERNS_FIELD, List.of(patternDocument));

            patternCollection.insert(newNamespaceDoc);
        } else {
            // Update existing namespace document
            List<Document> patterns = namespaceDocument.get(PATTERNS_FIELD, List.class);
            if (patterns == null) {
                patterns = new ArrayList<>();
            } else {
                patterns = new ArrayList<>(patterns); // Make a mutable copy
            }
            patterns.add(patternDocument);

            namespaceDocument.put(PATTERNS_FIELD, patterns);
            patternCollection.update(filter, namespaceDocument);
        }

        Pattern persistedPattern = new Pattern.PatternBuilder()
                .setId(id)
                .setNamespace(namespace)
                .setPattern(patternRequest.getPatternJson())
                .setVersion("1-0-0")
                .build();

        LOG.info("Created pattern with ID {} for namespace '{}'", id, namespace);
        return persistedPattern;
    }

    @Override
    public List<String> getPatternVersions(String namespace, int patternId) throws NamespaceNotFoundException, PatternNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving pattern versions", namespace);
            throw new NamespaceNotFoundException();
        }

        Document patternDoc = findPatternDocument(namespace, patternId);
        if (patternDoc == null) {
            LOG.warn("Pattern with ID {} not found in namespace '{}'", patternId, namespace);
            throw new PatternNotFoundException();
        }

        Document versions = patternDoc.get(VERSIONS_FIELD, Document.class);
        // In NitriteDB, we need to get the field names directly
        Set<String> fieldNames = versions.getFields();
        List<String> versionList = new ArrayList<>(fieldNames);

        LOG.debug("Retrieved {} versions for pattern {} in namespace '{}'",
                versionList.size(), patternId, namespace);
        return versionList;
    }

    @Override
    public String getPatternForVersion(String namespace, int patternId, String version) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving pattern version", namespace);
            throw new NamespaceNotFoundException();
        }

        Document patternDoc = findPatternDocument(namespace, patternId);
        if (patternDoc == null) {
            LOG.warn("Pattern with ID {} not found in namespace '{}'", patternId, namespace);
            throw new PatternNotFoundException();
        }

        Document versions = patternDoc.get(VERSIONS_FIELD, Document.class);
        String patternJson = versions.get(version.replace('.', '-'), String.class);

        if (patternJson == null) {
            LOG.warn("Version '{}' not found for pattern {} in namespace '{}'",
                    version.replace('.', '-'), patternId, namespace);
            throw new PatternVersionNotFoundException();
        }

        LOG.debug("Retrieved version '{}' for pattern {} in namespace '{}'",
                version.replace('.', '-'), patternId, namespace);
        return patternJson;
    }

    @Override
    public Pattern createPatternForVersion(CreatePatternRequest createPatternRequest, String namespace, int patternId, String version) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when creating pattern version", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter namespaceFilter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = patternCollection.find(namespaceFilter).firstOrNull();

        if (namespaceDocument == null) {
            LOG.warn("Namespace document for '{}' not found when creating pattern version", namespace);
            throw new PatternNotFoundException();
        }

        Document patternDoc = findPatternDocument(namespace, patternId);
        if (patternDoc == null) {
            LOG.warn("Pattern with ID {} not found in namespace '{}'", patternId, namespace);
            throw new PatternNotFoundException();
        }

        String mongoVersion = version.replace('.', '-');

        Document versions = patternDoc.get(VERSIONS_FIELD, Document.class);
        if (versions.containsKey(mongoVersion)) {
            LOG.warn("Version '{}' already exists for pattern {} in namespace '{}'",
                    mongoVersion, patternId, namespace);
            throw new PatternVersionExistsException();
        }

        // Add the new version
        versions.put(mongoVersion, createPatternRequest.getPatternJson());
        patternDoc.put(VERSIONS_FIELD, versions);

        // Update the pattern in the namespace document
        List<Document> patterns = namespaceDocument.get(PATTERNS_FIELD, List.class);
        // Create a mutable copy of the list
        patterns = new ArrayList<>(patterns);
        for (int i = 0; i < patterns.size(); i++) {
            Document doc = patterns.get(i);
            if (doc.get(PATTERN_ID_FIELD, Integer.class) == patternId) {
                patterns.set(i, patternDoc);
                break;
            }
        }

        namespaceDocument.put(PATTERNS_FIELD, patterns);
        patternCollection.update(namespaceFilter, namespaceDocument);

        Pattern pattern = new Pattern.PatternBuilder()
                .setId(patternId)
                .setNamespace(namespace)
                .setPattern(patternJson.get(JSON_FIELD, String.class))
                .setVersion(version)
                .build();

        LOG.info("Created version '{}' for pattern {} in namespace '{}'",
                mongoVersion, patternId, namespace);
        return pattern;
    }

    @Override
    public Pattern updatePatternForVersion(CreatePatternRequest createPatternRequest, String namespace, int patternId, String version) throws NamespaceNotFoundException, PatternNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when updating pattern version", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter namespaceFilter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = patternCollection.find(namespaceFilter).firstOrNull();

        if (namespaceDocument == null) {
            LOG.warn("Namespace document for '{}' not found when updating pattern version", namespace);
            throw new PatternNotFoundException();
        }

        Document patternDoc = findPatternDocument(namespace, patternId);
        if (patternDoc == null) {
            LOG.warn("Pattern with ID {} not found in namespace '{}'", patternId, namespace);
            throw new PatternNotFoundException();
        }

        String mongoVersion = version.replace('.', '-');

        Document versions = patternDoc.get(VERSIONS_FIELD, Document.class);
        versions.put(mongoVersion, createPatternRequest.getPatternJson());
        patternDoc.put(VERSIONS_FIELD, versions);

        // Update the pattern in the namespace document
        List<Document> patterns = namespaceDocument.get(PATTERNS_FIELD, List.class);
        // Create a mutable copy of the list
        patterns = new ArrayList<>(patterns);
        for (int i = 0; i < patterns.size(); i++) {
            Document doc = patterns.get(i);
            if (doc.get(PATTERN_ID_FIELD, Integer.class) == patternId) {
                patterns.set(i, patternDoc);
                break;
            }
        }

        namespaceDocument.put(PATTERNS_FIELD, patterns);
        patternCollection.update(namespaceFilter, namespaceDocument);

        Pattern pattern = new Pattern.PatternBuilder()
                .setId(patternId)
                .setNamespace(namespace)
                .setPattern(createPatternRequest.getPatternJson())
                .setVersion(version)
                .build();

        LOG.info("Updated version '{}' for pattern {} in namespace '{}'",
                mongoVersion, patternId, namespace);
        return pattern;
    }

    /**
     * Helper method to find a pattern document by namespace and pattern ID.
     *
     * @param namespace The namespace
     * @param patternId The pattern ID
     * @return The pattern document, or null if not found
     */
    private Document findPatternDocument(String namespace, int patternId) {
        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDocument = patternCollection.find(filter).firstOrNull();

        if (namespaceDocument == null) {
            return null;
        }

        List<Document> patterns = namespaceDocument.get(PATTERNS_FIELD, List.class);
        if (patterns == null) {
            return null;
        }

        for (Object patternObj : patterns) {
            if (patternObj instanceof Document patternDoc) {
                Integer id = patternDoc.get(PATTERN_ID_FIELD, Integer.class);
                if (id != null && id == patternId) {
                    return patternDoc;
                }
            }
        }

        return null;
    }
}
