package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB-backed implementation of {@link StandardStore}.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per standard in {@code standards}, and one <em>version</em>
 * document per version in {@code standardVersions}. All document handling lives in
 * {@link MongoVersionDocumentStore}.
 *
 * <p>Two things differ from the Pattern and Flow ports, both preserving Standard's own
 * behaviour: version writes set name and description <em>unconditionally</em>, as Standard's
 * old shape did (Architecture's behaviour, not Pattern's); and there is no update path at
 * all, so nothing here upserts a version.</p>
 *
 * <p>Incidentally fixes a bug the old code carried a {@code FIXME} for: its
 * {@code retrieveStandardVersions} looked up only the namespace and ignored
 * {@code standardId}, which happened to work while a namespace held one standard. Existence
 * is now checked against {@code (namespace, standardId)} like every other type.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoStandardStore.class)
public class MongoStandardStore implements StandardStore {

    private static final String HEADER_COLLECTION = "standards";
    private static final String VERSION_COLLECTION = "standardVersions";
    private static final String ID_FIELD = "standardId";
    private static final String RESOURCE_LABEL = "Standard";
    private static final String INITIAL_VERSION = "1.0.0";

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoVersionDocumentStore documentStore;

    public MongoStandardStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.documentStore = new MongoVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION),
                database.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
    }

    @Override
    public List<NamespaceResourceSummary> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED);
    }

    @Override
    public Standard createStandardForNamespace(CreateStandardRequest standardRequest, String namespace) throws NamespaceNotFoundException {
        requireNamespace(namespace);

        Document content = Document.parse(standardRequest.getStandardJson());

        int id = counterStore.getNextStandardSequenceValue();
        documentStore.createHeader(namespace, id, standardRequest.getName(), standardRequest.getDescription());
        createInitialVersion(namespace, id, content);

        Standard createdStandard = new Standard(standardRequest);
        createdStandard.setId(id);
        createdStandard.setVersion(INITIAL_VERSION);
        return createdStandard;
    }

    @Override
    public List<String> getStandardVersions(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException {
        requireStandard(namespace, standardId);
        return documentStore.listVersions(namespace, standardId);
    }

    @Override
    public String getStandardForVersion(String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException {
        requireStandard(namespace, standardId);

        Document content = documentStore.getVersion(namespace, standardId, version);
        if (content == null) {
            throw new StandardVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public Standard createStandardForVersion(CreateStandardRequest standardRequest, String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        requireStandard(namespace, standardId);

        Document content = Document.parse(standardRequest.getStandardJson());
        if (!documentStore.createVersion(namespace, standardId, version, content)) {
            throw new StandardVersionExistsException();
        }

        // Unconditional, matching the old shape: Standard did not guard these on blank.
        documentStore.updateHeaderDetails(namespace, standardId,
                standardRequest.getName(), standardRequest.getDescription());

        Standard standard = new Standard(standardRequest);
        standard.setId(standardId);
        standard.setVersion(version);
        return standard;
    }

    /**
     * Writes the first version of a newly created standard, removing the header again if
     * that fails — a header with no versions cannot be removed through the API.
     */
    private void createInitialVersion(String namespace, int id, Document content) {
        boolean created;
        try {
            created = documentStore.createVersion(namespace, id, INITIAL_VERSION, content);
        } catch (RuntimeException e) {
            documentStore.deleteHeader(namespace, id);
            throw e;
        }
        if (!created) {
            documentStore.deleteHeader(namespace, id);
            throw StorageWriteException.writeFailed(new IllegalStateException(
                    "Version " + INITIAL_VERSION + " already exists for newly allocated "
                            + ID_FIELD + " " + id + " in namespace " + namespace));
        }
    }

    private void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }

    private void requireStandard(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException {
        requireNamespace(namespace);
        if (!documentStore.headerExists(namespace, standardId)) {
            throw new StandardNotFoundException();
        }
    }
}
