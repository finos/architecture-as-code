package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.flow.NamespaceFlowSummary;
import org.finos.calm.store.FlowStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * MongoDB-backed implementation of {@link FlowStore}.
 *
 * <h2>Document model &amp; concurrency</h2>
 * Follows the same namespace-scoped document pattern as {@link MongoArchitectureStore}:
 * one document per namespace (enforced by a unique index on {@code flows.namespace}),
 * with an array of flow sub-documents. New flows are added via upsert + {@code $push},
 * and new versions use an atomic conditional update with {@code $elemMatch} /
 * {@code $exists: false} to prevent duplicate version creation under concurrency.
 * Unique flow IDs are generated atomically by {@link MongoCounterStore}.
 *
 * @see MongoIndexInitializer
 * @see MongoCounterStore
 */
@ApplicationScoped
@Typed(MongoFlowStore.class)
public class MongoFlowStore implements FlowStore {
    private final MongoCollection<Document> flowCollection;
    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoFlowStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.flowCollection = database.getCollection("flows");
    }

    @Override
    public List<NamespaceFlowSummary> getFlowsForNamespace(String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = flowCollection.find(Filters.eq("namespace", namespace)).first();

        //protects from an unpopulated mongo collection
        if(namespaceDocument == null || namespaceDocument.isEmpty()) {
            return List.of();
        }

        List<Document> flows = namespaceDocument.getList("flows", Document.class);
        List<NamespaceFlowSummary> flowSummaries = new ArrayList<>();

        for (Document flow : flows) {
            Integer flowId = flow.getInteger("flowId");
            String name = flow.getString("name");
            String description = flow.getString("description");
            if (name == null) name = "Flow " + flowId;
            if (description == null) description = "";
            flowSummaries.add(new NamespaceFlowSummary(name, description, flowId));
        }

        return flowSummaries;
    }

    @Override
    public Flow createFlowForNamespace(CreateFlowRequest flowRequest, String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextFlowSequenceValue();
        Document flowDocument = new Document("flowId", id)
                .append("name", flowRequest.getName())
                .append("description", flowRequest.getDescription())
                .append("versions",
                new Document("1-0-0", Document.parse(flowRequest.getFlowJson())));

        flowCollection.updateOne(
                Filters.eq("namespace", namespace),
                Updates.push("flows", flowDocument),
                new UpdateOptions().upsert(true));

        Flow persistedFlow = new Flow.FlowBuilder()
                .setId(id)
                .setVersion("1.0.0")
                .setNamespace(namespace)
                .setFlow(flowRequest.getFlowJson())
                .build();

        return persistedFlow;
    }

    @Override
    public List<String> getFlowVersions(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        Document result = retrieveFlowVersions(flow);

        List<Document> flows = result.getList("flows", Document.class);
        for (Document flowDoc : flows) {
            if (flow.getId() == flowDoc.getInteger("flowId")) {
                // Extract the versions map from the matching flow
                Document versions = (Document) flowDoc.get("versions");
                Set<String> versionKeys = versions.keySet();

                // Convert from Mongo representation
                List<String> resourceVersions = new ArrayList<>();
                for (String versionKey : versionKeys) {
                    resourceVersions.add(versionKey.replace('-', '.'));
                }
                return resourceVersions;  // Return the list of version keys
            }
        }

        throw new FlowNotFoundException();
    }

    private Document retrieveFlowVersions(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        if(!namespaceStore.namespaceExists(flow.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", flow.getNamespace());
        Bson projection = Projections.fields(Projections.include("flows"));

        Document result = flowCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new FlowNotFoundException();
        }

        return result;
    }

    @Override
    public String getFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionNotFoundException {
        Document result = retrieveFlowVersions(flow);

        List<Document> flows = result.getList("flows", Document.class);
        for (Document flowDoc : flows) {
            if (flow.getId() == flowDoc.getInteger("flowId")) {
                // Retrieve the versions map from the matching flow
                Document versions = (Document) flowDoc.get("versions");

                // Return the flow JSON blob for the specified version
                Document versionDoc = (Document) versions.get(flow.getMongoVersion());
                log.info("VersionDoc: [{}], Mongo Version: [{}]", flowDoc.get("versions"), flow.getMongoVersion());
                if(versionDoc == null) {
                    throw new FlowVersionNotFoundException();
                }
                return versionDoc.toJson();
            }
        }
        // Flows is empty, no version to find
        throw new FlowVersionNotFoundException();
    }

    @Override
    public Flow createFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionExistsException {
        // Validates namespace and flow existence
        getFlowVersions(flow);

        // Atomic conditional update: only succeeds if the version doesn't already exist
        Document filter = new Document("namespace", flow.getNamespace())
                .append("flows", new Document("$elemMatch",
                        new Document("flowId", flow.getId())
                                .append("versions." + flow.getMongoVersion(), new Document("$exists", false))));

        Document update = new Document("$set",
                new Document("flows.$.versions." + flow.getMongoVersion(), Document.parse(flow.getFlowJson())));

        if (flowCollection.updateOne(filter, update).getMatchedCount() == 0) {
            throw new FlowVersionExistsException();
        }

        return flow;
    }

    @Override
    public Flow updateFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        if(!namespaceStore.namespaceExists(flow.getNamespace())) {
            throw new NamespaceNotFoundException();
        }
        writeFlowToMongo(flow);
        return flow;
    }

    private void writeFlowToMongo(Flow flow) throws FlowNotFoundException, NamespaceNotFoundException {
        retrieveFlowVersions(flow);

        Document flowDocument = Document.parse(flow.getFlowJson());
        Document filter = new Document("namespace", flow.getNamespace())
                .append("flows.flowId", flow.getId());
        Document update = new Document("$set",
                new Document("flows.$.versions." + flow.getMongoVersion(), flowDocument));

        try {
            flowCollection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch (MongoWriteException ex) {
            log.error("Failed to write flow to mongo [{}]", flow, ex);
            throw new FlowNotFoundException();
        }
    }

}
