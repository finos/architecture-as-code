package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.MongoVersionDocumentStore.INITIAL_VERSION;

/**
 * MongoDB-backed implementation of {@link PatternStore}.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per pattern in {@code patterns}, and one <em>version</em>
 * document per version in {@code patternVersions}. All document handling lives in
 * {@link MongoVersionDocumentStore}; this class only translates between that and the
 * domain's objects and exceptions. See
 * {@code calm-hub/decisions/0001-versioned-artefact-storage.md}.
 *
 * <h2>One deliberate difference from {@link MongoArchitectureStore}</h2>
 * Version writes update the header's name and description only when they are non-blank
 * ({@code updatePresentHeaderDetails} rather than {@code updateHeaderDetails}). Pattern's
 * old shape guarded those fields; Architecture's set them unconditionally and so could wipe
 * a stored name. Both are preserved as they were — this is a real behavioural difference
 * between the two types, not an inconsistency to tidy away.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoPatternStore.class)
public class MongoPatternStore implements PatternStore {

    private static final String HEADER_COLLECTION = "patterns";
    private static final String VERSION_COLLECTION = "patternVersions";
    private static final String ID_FIELD = "patternId";
    private static final String RESOURCE_LABEL = "Pattern";

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoVersionDocumentStore documentStore;

    public MongoPatternStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.documentStore = new MongoVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION),
                database.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
    }

    @Override
    public List<NamespaceResourceSummary> getPatternsForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, page);
    }

    @Override
    public Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        // Parsed before the counter is drawn and before anything is written, so malformed
        // JSON can't leave a header behind with no version to go with it.
        Document content = Document.parse(patternRequest.getPatternJson());

        int id = counterStore.getNextPatternSequenceValue();
        documentStore.createHeader(namespace, id, patternRequest.getName(), patternRequest.getDescription());
        documentStore.createFirstVersion(namespace, id, content);

        return new Pattern.PatternBuilder()
                .setId(id)
                .setVersion(INITIAL_VERSION)
                .setNamespace(namespace)
                .setPattern(patternRequest.getPatternJson())
                .build();
    }

    @Override
    public List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        requirePattern(pattern);
        // A pattern with no versions yet returns an empty list rather than reporting itself
        // missing — the header above already settled that question.
        return documentStore.listVersions(pattern.getNamespace(), pattern.getId());
    }

    @Override
    public String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        requirePattern(pattern);

        Document content = documentStore.getVersion(
                pattern.getNamespace(), pattern.getId(), pattern.getDotVersion());
        if (content == null) {
            throw new PatternVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException {
        requirePattern(pattern);

        Document content = Document.parse(pattern.getPatternJson());
        boolean created = documentStore.createVersion(
                pattern.getNamespace(), pattern.getId(), pattern.getDotVersion(), content);
        if (!created) {
            throw new PatternVersionExistsException();
        }

        updateHeaderDetails(pattern);
        return pattern;
    }

    @Override
    public Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        requirePattern(pattern);

        Document content = Document.parse(pattern.getPatternJson());
        documentStore.upsertVersion(
                pattern.getNamespace(), pattern.getId(), pattern.getDotVersion(), content);

        updateHeaderDetails(pattern);
        return pattern;
    }

    /**
     * Applies the name and description that came with a version write, ignoring either that
     * is blank. Called only <em>after</em> the version write succeeds: the old shape set
     * both fields in the same conditional update that wrote the content, so a create
     * rejected for an already-existing version left them untouched.
     */
    private void updateHeaderDetails(Pattern pattern) {
        documentStore.updatePresentHeaderDetails(pattern.getNamespace(), pattern.getId(),
                pattern.getName(), pattern.getDescription());
    }

    private void requirePattern(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        namespaceStore.requireNamespace(pattern.getNamespace());
        if (!documentStore.headerExists(pattern.getNamespace(), pattern.getId())) {
            throw new PatternNotFoundException();
        }
    }

    @Override
    public void deletePattern(String namespace, int patternId) throws NamespaceNotFoundException, PatternNotFoundException {
        namespaceStore.requireNamespace(namespace);
        if (!documentStore.deleteResource(namespace, patternId)) {
            throw new PatternNotFoundException();
        }
    }
}
