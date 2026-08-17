package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.NitriteVersionDocumentStore.INITIAL_VERSION;

/**
 * NitriteDB-backed implementation of {@link FlowStore}, used in standalone mode.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per flow in {@code flows}, and one <em>version</em> document
 * per version in {@code flowVersions}, mirroring {@link org.finos.calm.store.mongo.MongoFlowStore}.
 * All document handling and locking live in {@link NitriteVersionDocumentStore}.
 *
 * <p>As with the other Nitrite stores, content is held as a JSON string rather than a parsed
 * document, and JSON is validated up front — before the flow's existence is checked, where
 * Mongo reports the missing flow first.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteFlowStore.class)
public class NitriteFlowStore implements FlowStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteFlowStore.class);
    private static final String HEADER_COLLECTION = "flows";
    private static final String VERSION_COLLECTION = "flowVersions";
    private static final String ID_FIELD = "flowId";
    private static final String RESOURCE_LABEL = "Flow";

    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final NitriteVersionDocumentStore documentStore;

    @Inject
    public NitriteFlowStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        this.documentStore = new NitriteVersionDocumentStore(
                db.getCollection(HEADER_COLLECTION),
                db.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
        LOG.info("NitriteFlowStore initialized with collections: {} / {}", HEADER_COLLECTION, VERSION_COLLECTION);
    }

    @Override
    public List<NamespaceResourceSummary> getFlowsForNamespace(String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED);
    }

    @Override
    public Flow createFlowForNamespace(CreateFlowRequest flowRequest, String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        validateFlowJson(flowRequest.getFlowJson());

        int id = counterStore.getNextFlowSequenceValue();
        documentStore.createHeader(namespace, id, flowRequest.getName(), flowRequest.getDescription());
        documentStore.createFirstVersion(namespace, id, flowRequest.getFlowJson());

        LOG.info("Created flow with ID {} for namespace '{}'", id, namespace);
        return new Flow.FlowBuilder()
                .setId(id)
                .setVersion(INITIAL_VERSION)
                .setNamespace(namespace)
                .setFlow(flowRequest.getFlowJson())
                .build();
    }

    @Override
    public List<String> getFlowVersions(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        requireFlow(flow);
        return documentStore.listVersions(flow.getNamespace(), flow.getId());
    }

    @Override
    public String getFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionNotFoundException {
        requireFlow(flow);

        String content = documentStore.getVersion(flow.getNamespace(), flow.getId(), flow.getDotVersion());
        if (content == null) {
            LOG.warn("Version '{}' not found for flow {} in namespace '{}'",
                    flow.getDotVersion(), flow.getId(), flow.getNamespace());
            throw new FlowVersionNotFoundException();
        }
        return content;
    }

    @Override
    public Flow createFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionExistsException {
        namespaceStore.requireNamespace(flow.getNamespace());
        validateFlowJson(flow.getFlowJson());
        requireFlowExists(flow);

        if (!documentStore.createVersion(flow.getNamespace(), flow.getId(), flow.getDotVersion(), flow.getFlowJson())) {
            LOG.warn("Version '{}' already exists for flow {} in namespace '{}'",
                    flow.getDotVersion(), flow.getId(), flow.getNamespace());
            throw new FlowVersionExistsException();
        }

        updateHeaderDetails(flow);
        return flow;
    }

    @Override
    public Flow updateFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        namespaceStore.requireNamespace(flow.getNamespace());
        validateFlowJson(flow.getFlowJson());
        requireFlowExists(flow);

        documentStore.upsertVersion(flow.getNamespace(), flow.getId(), flow.getDotVersion(), flow.getFlowJson());

        updateHeaderDetails(flow);
        return flow;
    }

    /**
     * Validates that the supplied flow JSON is parseable, throwing {@link JsonParseException}
     * if not so the REST layer can surface a 400.
     */
    private void validateFlowJson(String flowJson) {
        if (flowJson == null) {
            LOG.error("Flow JSON must not be null");
            throw new JsonParseException("Flow JSON must not be null");
        }
        try {
            org.bson.Document.parse(flowJson);
        } catch (Exception e) {
            LOG.error("Invalid JSON format for flow: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }
    }

    private void updateHeaderDetails(Flow flow) {
        documentStore.updatePresentHeaderDetails(flow.getNamespace(), flow.getId(),
                flow.getName(), flow.getDescription());
    }

    private void requireFlowExists(Flow flow) throws FlowNotFoundException {
        if (!documentStore.headerExists(flow.getNamespace(), flow.getId())) {
            LOG.warn("Flow with ID {} not found in namespace '{}'", flow.getId(), flow.getNamespace());
            throw new FlowNotFoundException();
        }
    }

    private void requireFlow(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        namespaceStore.requireNamespace(flow.getNamespace());
        requireFlowExists(flow);
    }
}
