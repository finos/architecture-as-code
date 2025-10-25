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
import org.finos.calm.store.FlowStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

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
    public List<Integer> getFlowsForNamespace(String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = flowCollection.find(Filters.eq("namespace", namespace)).first();

        //protects from an unpopulated mongo collection
        if(namespaceDocument == null || namespaceDocument.isEmpty()) {
            return List.of();
        }

        List<Document> patterns = namespaceDocument.getList("flows", Document.class);
        List<Integer> flowIds = new ArrayList<>();

        for (Document pattern : patterns) {
            flowIds.add(pattern.getInteger("flowId"));
        }

        return flowIds;
    }

    @Override
    public Flow createFlowForNamespace(Flow flow) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(flow.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextFlowSequenceValue();
        Document flowDocument = new Document("flowId", id).append("versions",
                new Document("1-0-0", Document.parse(flow.getFlowJson())));

        flowCollection.updateOne(
                Filters.eq("namespace", flow.getNamespace()),
                Updates.push("flows", flowDocument),
                new UpdateOptions().upsert(true));

        Flow persistedFlow = new Flow.FlowBuilder()
                .setId(id)
                .setVersion("1.0.0")
                .setNamespace(flow.getNamespace())
                .setFlow(flow.getFlowJson())
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
        if(!namespaceStore.namespaceExists(flow.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        if(versionExists(flow)) {
            throw new FlowVersionExistsException();
        }

        writeFlowToMongo(flow);
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

    private boolean versionExists(Flow flow) {
        Document filter = new Document("namespace", flow.getNamespace()).append("flows.flowId", flow.getId());
        Bson projection = Projections.fields(Projections.include("flows.versions." + flow.getMongoVersion()));
        Document result = flowCollection.find(filter).projection(projection).first();

        if (result != null) {
            List<Document> flows = result.getList("flows", Document.class);
            for (Document flowDoc : flows) {
                Document versions = (Document) flowDoc.get("versions");
                if (versions != null && versions.containsKey(flow.getMongoVersion())) {
                    return true;  // The version already exists
                }
            }
        }
        return false;
    }
}
