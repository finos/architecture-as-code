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

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the FlowStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteFlowStore.class)
public class NitriteFlowStore implements FlowStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteFlowStore.class);
    private static final String COLLECTION_NAME = "flows";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String FLOWS_FIELD = "flows";
    private static final String FLOW_ID_FIELD = "flowId";
    private static final String VERSIONS_FIELD = "versions";

    private final NitriteCollection flowCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;

    @Inject
    public NitriteFlowStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.flowCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        LOG.info("NitriteFlowStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<Integer> getFlowsForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving flows", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDoc = flowCollection.find(filter).firstOrNull();

        if (namespaceDoc == null) {
            LOG.warn("No flows found for namespace '{}'", namespace);
            return List.of();
        }

        List<Document> flows = namespaceDoc.get(FLOWS_FIELD, List.class);
        if (flows == null || flows.isEmpty()) {
            return List.of();
        }

        List<Integer> flowIds = new ArrayList<>();
        for (Document flow : flows) {
            flowIds.add(flow.get(FLOW_ID_FIELD, Integer.class));
        }

        return flowIds;
    }

    @Override
    public Flow createFlowForNamespace(Flow flow) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(flow.getNamespace())) {
            LOG.warn("Namespace '{}' not found when creating flow", flow.getNamespace());
            throw new NamespaceNotFoundException();
        }

        // Validate JSON
        try {
            // Use org.bson.Document to validate JSON
            org.bson.Document.parse(flow.getFlowJson());
        } catch (Exception e) {
            LOG.error("Invalid JSON format for flow: {}", e.getMessage());
            throw new JsonParseException(e.getMessage());
        }

        int id = counterStore.getNextFlowSequenceValue();
        Document flowDocument = Document.createDocument()
                .put(FLOW_ID_FIELD, id)
                .put(VERSIONS_FIELD, Document.createDocument()
                        .put("1-0-0", flow.getFlowJson()));

        Filter filter = where(NAMESPACE_FIELD).eq(flow.getNamespace());
        Document namespaceDoc = flowCollection.find(filter).firstOrNull();

        if (namespaceDoc == null) {
            // Create a new namespace document with the flow
            namespaceDoc = Document.createDocument()
                    .put(NAMESPACE_FIELD, flow.getNamespace())
                    .put(FLOWS_FIELD, List.of(flowDocument));
            flowCollection.insert(namespaceDoc);
        } else {
            // Add the flow to the existing namespace document
            List<Document> flows = namespaceDoc.get(FLOWS_FIELD, List.class);
            if (flows == null) {
                flows = new ArrayList<>();
            } else {
                flows = new ArrayList<>(flows); // Make a mutable copy
            }
            flows.add(flowDocument);
            namespaceDoc.put(FLOWS_FIELD, flows);
            flowCollection.update(filter, namespaceDoc);
        }

        LOG.info("Created flow with ID {} for namespace '{}'", id, flow.getNamespace());

        return new Flow.FlowBuilder()
                .setId(id)
                .setVersion("1.0.0")
                .setNamespace(flow.getNamespace())
                .setFlow(flow.getFlowJson())
                .build();
    }

    @Override
    public List<String> getFlowVersions(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        Document result = retrieveFlowVersions(flow);

        List<Document> flows = result.get(FLOWS_FIELD, List.class);
        for (Document flowDoc : flows) {
            if (flow.getId() == flowDoc.get(FLOW_ID_FIELD, Integer.class)) {
                // Extract the versions map from the matching flow
                Document versions = flowDoc.get(VERSIONS_FIELD, Document.class);

                // Convert from Nitrite representation
                List<String> resourceVersions = new ArrayList<>();
                if (versions != null) {
                    Set<String> versionKeys = versions.getFields();
                    for (String versionKey : versionKeys) {
                        resourceVersions.add(versionKey.replace('-', '.'));
                    }
                }
                return resourceVersions;  // Return the list of version keys
            }
        }

        throw new FlowNotFoundException();
    }

    private Document retrieveFlowVersions(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        if (!namespaceStore.namespaceExists(flow.getNamespace())) {
            LOG.warn("Namespace '{}' not found when retrieving flow versions", flow.getNamespace());
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(flow.getNamespace());
        Document result = flowCollection.find(filter).firstOrNull();

        if (result == null) {
            LOG.warn("No flows found for namespace '{}'", flow.getNamespace());
            throw new FlowNotFoundException();
        }

        return result;
    }

    @Override
    public String getFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionNotFoundException {
        Document result = retrieveFlowVersions(flow);

        List<Document> flows = result.get(FLOWS_FIELD, List.class);
        for (Document flowDoc : flows) {
            if (flow.getId() == flowDoc.get(FLOW_ID_FIELD, Integer.class)) {
                // Retrieve the versions map from the matching flow
                Document versions = flowDoc.get(VERSIONS_FIELD, Document.class);

                // Return the flow JSON blob for the specified version
                String mongoVersion = flow.getMongoVersion();
                Object versionObj = versions.get(mongoVersion);
                LOG.info("VersionDoc: [{}], Mongo Version: [{}]", versions, mongoVersion);

                if (versionObj == null) {
                    LOG.warn("Version '{}' not found for flow {} in namespace '{}'", 
                            flow.getDotVersion(), flow.getId(), flow.getNamespace());
                    throw new FlowVersionNotFoundException();
                }

                // In NitriteDB, we're storing the JSON as a string directly
                // No need to convert to JSON string
                return (String) versionObj;
            }
        }

        // Flows is empty, no version to find
        LOG.warn("Flow with ID {} not found in namespace '{}'", flow.getId(), flow.getNamespace());
        throw new FlowVersionNotFoundException();
    }

    @Override
    public Flow createFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionExistsException {
        if (!namespaceStore.namespaceExists(flow.getNamespace())) {
            LOG.warn("Namespace '{}' not found when creating flow version", flow.getNamespace());
            throw new NamespaceNotFoundException();
        }

        if (versionExists(flow)) {
            LOG.warn("Version '{}' already exists for flow {} in namespace '{}'", 
                    flow.getDotVersion(), flow.getId(), flow.getNamespace());
            throw new FlowVersionExistsException();
        }

        writeFlowToNitrite(flow);
        return flow;
    }

    @Override
    public Flow updateFlowForVersion(Flow flow) throws NamespaceNotFoundException, FlowNotFoundException {
        if (!namespaceStore.namespaceExists(flow.getNamespace())) {
            LOG.warn("Namespace '{}' not found when updating flow version", flow.getNamespace());
            throw new NamespaceNotFoundException();
        }

        writeFlowToNitrite(flow);
        LOG.info("Updated version '{}' for flow {} in namespace '{}'", 
                flow.getDotVersion(), flow.getId(), flow.getNamespace());
        return flow;
    }

    private void writeFlowToNitrite(Flow flow) throws FlowNotFoundException, NamespaceNotFoundException {
        // First verify the flow exists
        retrieveFlowVersions(flow);

        // Find the namespace document
        Filter filter = where(NAMESPACE_FIELD).eq(flow.getNamespace());
        Document namespaceDoc = flowCollection.find(filter).firstOrNull();

        if (namespaceDoc != null) {
            List<Document> flows = namespaceDoc.get(FLOWS_FIELD, List.class);
            if (flows != null) {
                // Create a mutable copy of the list
                flows = new ArrayList<>(flows);
                boolean found = false;
                for (int i = 0; i < flows.size(); i++) {
                    Document flowDoc = flows.get(i);
                    if (flowDoc.get(FLOW_ID_FIELD, Integer.class) == flow.getId()) {
                        // Found the flow, update its version
                        Document versions = flowDoc.get(VERSIONS_FIELD, Document.class);
                        versions.put(flow.getMongoVersion(), flow.getFlowJson());
                        flowDoc.put(VERSIONS_FIELD, versions);
                        flows.set(i, flowDoc);
                        found = true;
                        break;
                    }
                }

                if (found) {
                    namespaceDoc.put(FLOWS_FIELD, flows);
                    flowCollection.update(filter, namespaceDoc);
                    return;
                }
            }
        }

        LOG.warn("Flow with ID {} not found in namespace '{}'", flow.getId(), flow.getNamespace());
        throw new FlowNotFoundException();
    }

    private boolean versionExists(Flow flow) {
        try {
            Document result = retrieveFlowVersions(flow);

            List<Document> flows = result.get(FLOWS_FIELD, List.class);
            for (Document flowDoc : flows) {
                if (flow.getId() == flowDoc.get(FLOW_ID_FIELD, Integer.class)) {
                    Document versions = flowDoc.get(VERSIONS_FIELD, Document.class);
                    if (versions != null && versions.containsKey(flow.getMongoVersion())) {
                        return true;  // The version already exists
                    }
                }
            }
        } catch (NamespaceNotFoundException | FlowNotFoundException e) {
            return false;
        }

        return false;
    }
}
