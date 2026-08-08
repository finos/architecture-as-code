package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.NitriteVersionDocumentStore.INITIAL_VERSION;

/**
 * NitriteDB-backed implementation of {@link PatternStore}, used in standalone mode.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per pattern in {@code patterns}, and one <em>version</em>
 * document per version in {@code patternVersions}, mirroring {@link org.finos.calm.store.mongo.MongoPatternStore}.
 * All document handling and locking live in {@link NitriteVersionDocumentStore}.
 *
 * <p>As with the Architecture pair, two differences from the Mongo implementation are
 * deliberate and predate this shape: content is stored as a JSON string rather than a parsed
 * document, and JSON is validated up front by {@link #validatePatternJson} before the
 * pattern's existence is checked — so a request that is both malformed and aimed at a
 * missing pattern reports the parse failure here and the missing pattern on Mongo.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitritePatternStore.class)
public class NitritePatternStore implements PatternStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitritePatternStore.class);
    private static final String HEADER_COLLECTION = "patterns";
    private static final String VERSION_COLLECTION = "patternVersions";
    private static final String ID_FIELD = "patternId";
    private static final String RESOURCE_LABEL = "Pattern";

    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final NitriteVersionDocumentStore documentStore;

    @Inject
    public NitritePatternStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        this.documentStore = new NitriteVersionDocumentStore(
                db.getCollection(HEADER_COLLECTION),
                db.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
        LOG.info("NitritePatternStore initialized with collections: {} / {}", HEADER_COLLECTION, VERSION_COLLECTION);
    }

    @Override
    public List<NamespaceResourceSummary> getPatternsForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, page);
    }

    @Override
    public Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException, JsonParseException {
        namespaceStore.requireNamespace(namespace);
        validatePatternJson(patternRequest.getPatternJson());

        int id = counterStore.getNextPatternSequenceValue();
        documentStore.createHeader(namespace, id, patternRequest.getName(), patternRequest.getDescription());
        documentStore.createFirstVersion(namespace, id, patternRequest.getPatternJson());

        LOG.info("Created pattern with ID {} for namespace '{}'", id, namespace);
        return new Pattern.PatternBuilder()
                .setId(id)
                // Dot-separated, matching the Mongo store and what is actually stored. This
                // backend used to return "1-0-0" here, so the Location header differed by
                // backend for the same operation.
                .setVersion(INITIAL_VERSION)
                .setNamespace(namespace)
                .setPattern(patternRequest.getPatternJson())
                .build();
    }

    @Override
    public List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        requirePattern(pattern);
        return documentStore.listVersions(pattern.getNamespace(), pattern.getId());
    }

    @Override
    public String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        requirePattern(pattern);

        String content = documentStore.getVersion(
                pattern.getNamespace(), pattern.getId(), pattern.getDotVersion());
        if (content == null) {
            LOG.warn("Version '{}' not found for pattern {} in namespace '{}'",
                    pattern.getDotVersion(), pattern.getId(), pattern.getNamespace());
            throw new PatternVersionNotFoundException();
        }
        return content;
    }

    @Override
    public Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException {
        namespaceStore.requireNamespace(pattern.getNamespace());
        validatePatternJson(pattern.getPatternJson());
        requirePatternExists(pattern);

        boolean created = documentStore.createVersion(pattern.getNamespace(), pattern.getId(),
                pattern.getDotVersion(), pattern.getPatternJson());
        if (!created) {
            LOG.warn("Version '{}' already exists for pattern {} in namespace '{}'",
                    pattern.getDotVersion(), pattern.getId(), pattern.getNamespace());
            throw new PatternVersionExistsException();
        }

        updateHeaderDetails(pattern);
        return pattern;
    }

    @Override
    public Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        namespaceStore.requireNamespace(pattern.getNamespace());
        validatePatternJson(pattern.getPatternJson());
        requirePatternExists(pattern);

        documentStore.upsertVersion(pattern.getNamespace(), pattern.getId(),
                pattern.getDotVersion(), pattern.getPatternJson());

        updateHeaderDetails(pattern);
        return pattern;
    }

    /**
     * Validates that the supplied pattern JSON is parseable, throwing {@link JsonParseException} if not so the
     * REST layer can surface a 400. Validation runs immediately after the namespace check, before any existence or
     * version checks, so a malformed payload is rejected consistently regardless of the operation.
     *
     * @param patternJson the raw pattern JSON to validate
     */
    private void validatePatternJson(String patternJson) {
        if (patternJson == null) {
            LOG.error("Pattern JSON must not be null");
            throw new JsonParseException("Pattern JSON must not be null");
        }
        try {
            // Validate JSON by attempting to parse it
            org.bson.Document.parse(patternJson);
        } catch (JsonParseException e) {
            // Rethrow the original so the parse failure's stack trace is preserved for observability
            LOG.error("Invalid JSON format for pattern: {}", e.getMessage());
            throw e;
        }
    }

    /**
     * Applies the name and description that came with a version write, ignoring either that
     * is blank, and only after the version write succeeds.
     */
    private void updateHeaderDetails(Pattern pattern) {
        documentStore.updatePresentHeaderDetails(pattern.getNamespace(), pattern.getId(),
                pattern.getName(), pattern.getDescription());
    }

    private void requirePatternExists(Pattern pattern) throws PatternNotFoundException {
        if (!documentStore.headerExists(pattern.getNamespace(), pattern.getId())) {
            LOG.warn("Pattern with ID {} not found in namespace '{}'", pattern.getId(), pattern.getNamespace());
            throw new PatternNotFoundException();
        }
    }

    private void requirePattern(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        namespaceStore.requireNamespace(pattern.getNamespace());
        requirePatternExists(pattern);
    }
}
