package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.util.NamespaceGuard;
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.NitriteVersionDocumentStore.INITIAL_VERSION;

/**
 * NitriteDB-backed implementation of {@link StandardStore}, used in standalone mode.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per standard in {@code standards}, and one <em>version</em>
 * document per version in {@code standardVersions}, mirroring
 * {@link org.finos.calm.store.mongo.MongoStandardStore}. Content is held as a JSON string,
 * and version writes set name and description unconditionally, both matching what this
 * store did before.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteStandardStore.class)
public class NitriteStandardStore implements StandardStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteStandardStore.class);
    private static final String HEADER_COLLECTION = "standards";
    private static final String VERSION_COLLECTION = "standardVersions";
    private static final String ID_FIELD = "standardId";
    private static final String RESOURCE_LABEL = "Standard";

    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final NitriteVersionDocumentStore documentStore;

    @Inject
    public NitriteStandardStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        this.documentStore = new NitriteVersionDocumentStore(
                db.getCollection(HEADER_COLLECTION),
                db.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
        LOG.info("NitriteStandardStore initialized with collections: {} / {}", HEADER_COLLECTION, VERSION_COLLECTION);
    }

    @Override
    public List<NamespaceResourceSummary> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        NamespaceGuard.requireNamespace(namespaceStore, namespace);
        return documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED);
    }

    @Override
    public Standard createStandardForNamespace(CreateStandardRequest createStandardRequest, String namespace) throws NamespaceNotFoundException {
        Standard createdStandard = new Standard(createStandardRequest);
        NamespaceGuard.requireNamespace(namespaceStore, namespace);
        validateStandardJson(createStandardRequest.getStandardJson());

        int id = counterStore.getNextStandardSequenceValue();
        documentStore.createHeader(namespace, id, createStandardRequest.getName(), createStandardRequest.getDescription());
        documentStore.createFirstVersion(namespace, id, createStandardRequest.getStandardJson());

        LOG.info("Created standard with ID {} for namespace '{}'", id, namespace);
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

        String content = documentStore.getVersion(namespace, standardId, version);
        if (content == null) {
            LOG.warn("Version '{}' not found for standard {} in namespace '{}'", version, standardId, namespace);
            throw new StandardVersionNotFoundException();
        }
        return content;
    }

    @Override
    public Standard createStandardForVersion(CreateStandardRequest standardRequest, String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        NamespaceGuard.requireNamespace(namespaceStore, namespace);
        validateStandardJson(standardRequest.getStandardJson());
        requireStandardExists(namespace, standardId);

        if (!documentStore.createVersion(namespace, standardId, version, standardRequest.getStandardJson())) {
            LOG.warn("Version '{}' already exists for standard {} in namespace '{}'", version, standardId, namespace);
            throw new StandardVersionExistsException();
        }

        // Unconditional, matching the old shape: Standard did not guard these on blank.
        documentStore.updateHeaderDetails(namespace, standardId,
                standardRequest.getName(), standardRequest.getDescription());

        LOG.info("Created version '{}' for standard {} in namespace '{}'", version, standardId, namespace);
        Standard standard = new Standard(standardRequest);
        standard.setVersion(version);
        standard.setId(standardId);
        standard.setNamespace(namespace);
        return standard;
    }

    /**
     * Validates that the supplied standard JSON is parseable, throwing
     * {@link JsonParseException} if not so the REST layer can surface a 400.
     */
    private void validateStandardJson(String standardJson) {
        if (standardJson == null) {
            LOG.error("Standard JSON must not be null");
            throw new JsonParseException("Standard JSON must not be null");
        }
        try {
            org.bson.Document.parse(standardJson);
        } catch (Exception e) {
            LOG.error("Invalid JSON format for standard: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }
    }

    private void requireStandardExists(String namespace, Integer standardId) throws StandardNotFoundException {
        if (!documentStore.headerExists(namespace, standardId)) {
            LOG.warn("Standard with ID {} not found in namespace '{}'", standardId, namespace);
            throw new StandardNotFoundException();
        }
    }

    private void requireStandard(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException {
        NamespaceGuard.requireNamespace(namespaceStore, namespace);
        requireStandardExists(namespace, standardId);
    }
}
