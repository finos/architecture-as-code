package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.MongoVersionDocumentStore;

import java.util.List;

import io.quarkus.arc.lookup.LookupIfProperty;

import static org.finos.calm.store.util.MongoVersionDocumentStore.INITIAL_VERSION;

/**
 * MongoDB-backed implementation of {@link FlowStore}.
 *
 * <h2>Document model</h2>
 * One <em>header</em> document per flow in {@code flows}, and one <em>version</em> document
 * per version in {@code flowVersions}. All document handling lives in
 * {@link MongoVersionDocumentStore}; this class only translates between that and the
 * domain's objects and exceptions. See
 * {@code calm-hub/decisions/0001-versioned-artefact-storage.md}.
 *
 * <p>Like Pattern and unlike Architecture, version writes update the header's name and
 * description only when they are non-blank — Flow's old shape guarded those fields.</p>
 *
 * <p>{@link FlowStore} exposes no paged listing, so summaries are always fetched
 * {@link PageRequest#UNPAGED}. The helper supports paging whenever the interface grows one.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoFlowStore.class)
public class MongoFlowStore implements FlowStore {

    private static final String HEADER_COLLECTION = "flows";
    private static final String VERSION_COLLECTION = "flowVersions";
    private static final String ID_FIELD = "flowId";
    private static final String RESOURCE_LABEL = "Flow";

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoVersionDocumentStore documentStore;

    public MongoFlowStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.documentStore = new MongoVersionDocumentStore(
                database.getCollection(HEADER_COLLECTION),
                database.getCollection(VERSION_COLLECTION),
                ID_FIELD,
                RESOURCE_LABEL);
    }

    @Override
    public List<NamespaceResourceSummary> getFlowsForNamespace(String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        return documentStore.listSummariesPaged(namespace, PageRequest.UNPAGED);
    }

    @Override
    public Flow createFlowForNamespace(CreateFlowRequest flowRequest, String namespace) throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);

        // Parsed before the counter is drawn and before anything is written, so malformed
        // JSON can't leave a header behind with no version to go with it.
        Document content = Document.parse(flowRequest.getFlowJson());

        int id = counterStore.getNextFlowSequenceValue();
        documentStore.createHeader(namespace, id, flowRequest.getName(), flowRequest.getDescription());
        documentStore.createFirstVersion(namespace, id, content);

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

        Document content = documentStore.getVersion(flow.getNamespace(), flow.getId(), flow.getDotVersion());
        if (content == null) {
            throw new FlowVersionNotFoundException();
        }
        return content.toJson();
    }

    @Override
    public Flow createFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionExistsException {
        requireFlow(flow);

        Document content = Document.parse(flow.getFlowJson());
        if (!documentStore.createVersion(flow.getNamespace(), flow.getId(), flow.getDotVersion(), content)) {
            throw new FlowVersionExistsException();
        }

        updateHeaderDetails(flow);
        return flow;
    }

    @Override
    public Flow updateFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        requireFlow(flow);

        Document content = Document.parse(flow.getFlowJson());
        documentStore.upsertVersion(flow.getNamespace(), flow.getId(), flow.getDotVersion(), content);

        updateHeaderDetails(flow);
        return flow;
    }

    /**
     * Applies the name and description that came with a version write, ignoring either that
     * is blank, and only after the version write succeeds.
     */
    private void updateHeaderDetails(Flow flow) {
        documentStore.updatePresentHeaderDetails(flow.getNamespace(), flow.getId(),
                flow.getName(), flow.getDescription());
    }

    private void requireFlow(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        namespaceStore.requireNamespace(flow.getNamespace());
        if (!documentStore.headerExists(flow.getNamespace(), flow.getId())) {
            throw new FlowNotFoundException();
        }
    }
}
