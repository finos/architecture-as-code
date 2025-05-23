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
                if (patternObj instanceof Document) {
                    Document patternDoc = (Document) patternObj;
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
    public Pattern createPatternForNamespace(Pattern pattern) throws NamespaceNotFoundException, JsonParseException {
        if (!namespaceStore.namespaceExists(pattern.getNamespace())) {
            LOG.warn("Namespace '{}' not found when creating pattern", pattern.getNamespace());
            throw new NamespaceNotFoundException();
        }

        try {
            // Validate JSON by attempting to parse it
            org.bson.Document.parse(pattern.getPatternJson());
        } catch (Exception e) {
            LOG.error("Invalid JSON format for pattern: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }

        int id = counterStore.getNextPatternSequenceValue();

        Filter filter = where(NAMESPACE_FIELD).eq(pattern.getNamespace());
        Document namespaceDocument = patternCollection.find(filter).firstOrNull();

        Document patternDocument = Document.createDocument()
                .put(PATTERN_ID_FIELD, id)
                .put(VERSIONS_FIELD, Document.createDocument().put("1-0-0", pattern.getPatternJson()));

        if (namespaceDocument == null) {
            // Create new namespace document with pattern
            Document newNamespaceDoc = Document.createDocument()
                    .put(NAMESPACE_FIELD, pattern.getNamespace())
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
                .setNamespace(pattern.getNamespace())
                .setPattern(pattern.getPatternJson())
                .setVersion("1-0-0")
                .build();

        LOG.info("Created pattern with ID {} for namespace '{}'", id, pattern.getNamespace());
        return persistedPattern;
    }

    @Override
    public List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        if (!namespaceStore.namespaceExists(pattern.getNamespace())) {
            LOG.warn("Namespace '{}' not found when retrieving pattern versions", pattern.getNamespace());
            throw new NamespaceNotFoundException();
        }

        Document patternDoc = findPatternDocument(pattern.getNamespace(), pattern.getId());
        if (patternDoc == null) {
            LOG.warn("Pattern with ID {} not found in namespace '{}'", pattern.getId(), pattern.getNamespace());
            throw new PatternNotFoundException();
        }

        Document versions = patternDoc.get(VERSIONS_FIELD, Document.class);
        List<String> versionList = new ArrayList<>();
        // In NitriteDB, we need to get the field names directly
        Set<String> fieldNames = versions.getFields();
        versionList.addAll(fieldNames);

        LOG.debug("Retrieved {} versions for pattern {} in namespace '{}'", 
                versionList.size(), pattern.getId(), pattern.getNamespace());
        return versionList;
    }

    @Override
    public String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        if (!namespaceStore.namespaceExists(pattern.getNamespace())) {
            LOG.warn("Namespace '{}' not found when retrieving pattern version", pattern.getNamespace());
            throw new NamespaceNotFoundException();
        }

        Document patternDoc = findPatternDocument(pattern.getNamespace(), pattern.getId());
        if (patternDoc == null) {
            LOG.warn("Pattern with ID {} not found in namespace '{}'", pattern.getId(), pattern.getNamespace());
            throw new PatternNotFoundException();
        }

        Document versions = patternDoc.get(VERSIONS_FIELD, Document.class);
        String patternJson = versions.get(pattern.getMongoVersion(), String.class);

        if (patternJson == null) {
            LOG.warn("Version '{}' not found for pattern {} in namespace '{}'", 
                    pattern.getMongoVersion(), pattern.getId(), pattern.getNamespace());
            throw new PatternVersionNotFoundException();
        }

        LOG.debug("Retrieved version '{}' for pattern {} in namespace '{}'", 
                pattern.getMongoVersion(), pattern.getId(), pattern.getNamespace());
        return patternJson;
    }

    @Override
    public Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException {
        if (!namespaceStore.namespaceExists(pattern.getNamespace())) {
            LOG.warn("Namespace '{}' not found when creating pattern version", pattern.getNamespace());
            throw new NamespaceNotFoundException();
        }

        Filter namespaceFilter = where(NAMESPACE_FIELD).eq(pattern.getNamespace());
        Document namespaceDocument = patternCollection.find(namespaceFilter).firstOrNull();

        if (namespaceDocument == null) {
            LOG.warn("Namespace document for '{}' not found when creating pattern version", pattern.getNamespace());
            throw new PatternNotFoundException();
        }

        Document patternDoc = findPatternDocument(pattern.getNamespace(), pattern.getId());
        if (patternDoc == null) {
            LOG.warn("Pattern with ID {} not found in namespace '{}'", pattern.getId(), pattern.getNamespace());
            throw new PatternNotFoundException();
        }

        Document versions = patternDoc.get(VERSIONS_FIELD, Document.class);
        if (versions.containsKey(pattern.getMongoVersion())) {
            LOG.warn("Version '{}' already exists for pattern {} in namespace '{}'", 
                    pattern.getMongoVersion(), pattern.getId(), pattern.getNamespace());
            throw new PatternVersionExistsException();
        }

        // Add the new version
        versions.put(pattern.getMongoVersion(), pattern.getPatternJson());
        patternDoc.put(VERSIONS_FIELD, versions);

        // Update the pattern in the namespace document
        List<Document> patterns = namespaceDocument.get(PATTERNS_FIELD, List.class);
        // Create a mutable copy of the list
        patterns = new ArrayList<>(patterns);
        for (int i = 0; i < patterns.size(); i++) {
            Document doc = (Document) patterns.get(i);
            if (doc.get(PATTERN_ID_FIELD, Integer.class) == pattern.getId()) {
                patterns.set(i, patternDoc);
                break;
            }
        }

        namespaceDocument.put(PATTERNS_FIELD, patterns);
        patternCollection.update(namespaceFilter, namespaceDocument);

        LOG.info("Created version '{}' for pattern {} in namespace '{}'", 
                pattern.getMongoVersion(), pattern.getId(), pattern.getNamespace());
        return pattern;
    }

    @Override
    public Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        if (!namespaceStore.namespaceExists(pattern.getNamespace())) {
            LOG.warn("Namespace '{}' not found when updating pattern version", pattern.getNamespace());
            throw new NamespaceNotFoundException();
        }

        Filter namespaceFilter = where(NAMESPACE_FIELD).eq(pattern.getNamespace());
        Document namespaceDocument = patternCollection.find(namespaceFilter).firstOrNull();

        if (namespaceDocument == null) {
            LOG.warn("Namespace document for '{}' not found when updating pattern version", pattern.getNamespace());
            throw new PatternNotFoundException();
        }

        Document patternDoc = findPatternDocument(pattern.getNamespace(), pattern.getId());
        if (patternDoc == null) {
            LOG.warn("Pattern with ID {} not found in namespace '{}'", pattern.getId(), pattern.getNamespace());
            throw new PatternNotFoundException();
        }

        Document versions = patternDoc.get(VERSIONS_FIELD, Document.class);
        versions.put(pattern.getMongoVersion(), pattern.getPatternJson());
        patternDoc.put(VERSIONS_FIELD, versions);

        // Update the pattern in the namespace document
        List<Document> patterns = namespaceDocument.get(PATTERNS_FIELD, List.class);
        // Create a mutable copy of the list
        patterns = new ArrayList<>(patterns);
        for (int i = 0; i < patterns.size(); i++) {
            Document doc = (Document) patterns.get(i);
            if (doc.get(PATTERN_ID_FIELD, Integer.class) == pattern.getId()) {
                patterns.set(i, patternDoc);
                break;
            }
        }

        namespaceDocument.put(PATTERNS_FIELD, patterns);
        patternCollection.update(namespaceFilter, namespaceDocument);

        LOG.info("Updated version '{}' for pattern {} in namespace '{}'", 
                pattern.getMongoVersion(), pattern.getId(), pattern.getNamespace());
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
            if (patternObj instanceof Document) {
                Document patternDoc = (Document) patternObj;
                Integer id = patternDoc.get(PATTERN_ID_FIELD, Integer.class);
                if (id != null && id == patternId) {
                    return patternDoc;
                }
            }
        }

        return null;
    }
}
