package org.finos.calm.store.nitrite;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.*;
import org.finos.calm.store.AdrStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the AdrStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteAdrStore.class)
public class NitriteAdrStore implements AdrStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteAdrStore.class);
    private static final String COLLECTION_NAME = "adrs";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ADR_ID_FIELD = "adrId";
    private static final String ADRS_FIELD = "adrs";
    private static final String REVISIONS_FIELD = "revisions";

    private final NitriteCollection adrCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;
    private final ObjectMapper objectMapper;

    @Inject
    public NitriteAdrStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore, NitriteCounterStore counterStore) {
        this.adrCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        this.objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        LOG.info("NitriteAdrStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<Integer> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving ADRs", namespace);
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = adrCollection.find(where(NAMESPACE_FIELD).eq(namespace)).firstOrNull();

        // Protects from an unpopulated collection
        if (namespaceDocument == null) {
            return List.of();
        }

        List<Document> adrs = namespaceDocument.get(ADRS_FIELD, List.class);
        if (adrs == null || adrs.isEmpty()) {
            return List.of();
        }

        List<Integer> adrIds = new ArrayList<>();
        for (Document adr : adrs) {
            adrIds.add(adr.get(ADR_ID_FIELD, Integer.class));
        }

        LOG.debug("Retrieved {} ADRs for namespace '{}'", adrIds.size(), namespace);
        return adrIds;
    }

    @Override
    public AdrMeta createAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrParseException {
        if (!namespaceStore.namespaceExists(adrMeta.getNamespace())) {
            LOG.warn("Namespace '{}' not found when creating ADR", adrMeta.getNamespace());
            throw new NamespaceNotFoundException();
        }

        String adrStr;
        try {
            adrStr = objectMapper.writeValueAsString(adrMeta.getAdr());
            // Validate JSON by attempting to parse it
            org.bson.Document.parse(adrStr);
        } catch (JsonProcessingException e) {
            LOG.error("Could not write ADR Content to String", e);
            throw new AdrParseException();
        } catch (Exception e) {
            LOG.error("Invalid JSON format for ADR: {}", e.getMessage());
            throw new AdrParseException();
        }

        int id = counterStore.getNextAdrSequenceValue();
        Document adrDocument = Document.createDocument()
                .put(ADR_ID_FIELD, id)
                .put(REVISIONS_FIELD, Document.createDocument()
                        .put(String.valueOf(adrMeta.getRevision()), adrStr));

        Filter filter = where(NAMESPACE_FIELD).eq(adrMeta.getNamespace());
        Document namespaceDoc = adrCollection.find(filter).firstOrNull();

        if (namespaceDoc == null) {
            // Create a new namespace document with the ADR
            namespaceDoc = Document.createDocument()
                    .put(NAMESPACE_FIELD, adrMeta.getNamespace())
                    .put(ADRS_FIELD, List.of(adrDocument));
            adrCollection.insert(namespaceDoc);
        } else {
            // Add the ADR to the existing namespace document
            List<Document> adrs = namespaceDoc.get(ADRS_FIELD, List.class);
            if (adrs == null) {
                adrs = new ArrayList<>();
            } else {
                adrs = new ArrayList<>(adrs); // Make a mutable copy
            }
            adrs.add(adrDocument);
            namespaceDoc.put(ADRS_FIELD, adrs);
            adrCollection.update(filter, namespaceDoc);
        }

        LOG.info("Created ADR with ID {} for namespace '{}'", id, adrMeta.getNamespace());
        return new AdrMeta.AdrMetaBuilder(adrMeta).setId(id).build();
    }

    @Override
    public AdrMeta getAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        Document adrDoc = retrieveAdrDoc(adrMeta);
        return retrieveLatestRevision(adrMeta, adrDoc);
    }

    @Override
    public List<Integer> getAdrRevisions(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        Document adrDoc = retrieveAdrDoc(adrMeta);
        Document revisions = retrieveRevisionsDoc(adrDoc, adrMeta);

        List<Integer> revisionList = new ArrayList<>();
        // In NitriteDB, we need to get the field names directly
        Set<String> fieldNames = revisions.getFields();
        for (String revision : fieldNames) {
            revisionList.add(Integer.parseInt(revision));
        }

        LOG.debug("Retrieved {} revisions for ADR {} in namespace '{}'", 
                revisionList.size(), adrMeta.getId(), adrMeta.getNamespace());
        return revisionList;
    }

    @Override
    public AdrMeta getAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        Document adrDoc = retrieveAdrDoc(adrMeta);
        Document revisionsDoc = retrieveRevisionsDoc(adrDoc, adrMeta);

        // Return the ADR JSON blob for the specified revision
        String adrStr = revisionsDoc.get(String.valueOf(adrMeta.getRevision()), String.class);
        LOG.info("RevisionDoc: [{}], Revision: [{}]", revisionsDoc, adrMeta.getRevision());

        if (adrStr == null) {
            LOG.warn("Revision {} not found for ADR {} in namespace '{}'", 
                    adrMeta.getRevision(), adrMeta.getId(), adrMeta.getNamespace());
            throw new AdrRevisionNotFoundException();
        }

        try {
            return new AdrMeta.AdrMetaBuilder(adrMeta)
                    .setAdr(objectMapper.readValue(adrStr, Adr.class))
                    .build();
        } catch (JsonProcessingException e) {
            LOG.error("Could not parse stored ADR to ADR Content.", e);
            throw new AdrParseException();
        }
    }

    @Override
    public AdrMeta updateAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException {
        Document adrDoc = retrieveAdrDoc(adrMeta);
        AdrMeta latestRevision = retrieveLatestRevision(adrMeta, adrDoc);

        int newRevision = latestRevision.getRevision() + 1;
        AdrMeta newAdrMeta = new AdrMeta.AdrMetaBuilder(adrMeta)
                .setAdr(new Adr.AdrBuilder(adrMeta.getAdr())
                        .setStatus(latestRevision.getAdr().getStatus())
                        .setCreationDateTime(latestRevision.getAdr().getCreationDateTime())
                        .build())
                .setRevision(newRevision)
                .build();

        writeAdrToNitrite(newAdrMeta);
        return newAdrMeta;
    }

    @Override
    public AdrMeta updateAdrStatus(AdrMeta adrMeta, Status status) throws AdrNotFoundException, NamespaceNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException {
        Document adrDoc = retrieveAdrDoc(adrMeta);
        AdrMeta latestRevision = retrieveLatestRevision(adrMeta, adrDoc);

        int newRevisionNum = latestRevision.getRevision() + 1;
        AdrMeta newRevision = new AdrMeta.AdrMetaBuilder(latestRevision)
                .setRevision(newRevisionNum)
                .setAdr(new Adr.AdrBuilder(latestRevision.getAdr())
                        .setStatus(status)
                        .build())
                .build();

        writeAdrToNitrite(newRevision);
        return newRevision;
    }

    private List<Document> retrieveAdrsDocs(String namespace) throws NamespaceNotFoundException, AdrNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving ADR documents", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document result = adrCollection.find(filter).firstOrNull();

        if (result == null) {
            LOG.warn("No ADRs found for namespace '{}'", namespace);
            throw new AdrNotFoundException();
        }

        List<Document> adrs = result.get(ADRS_FIELD, List.class);
        if (adrs == null || adrs.isEmpty()) {
            LOG.warn("Empty ADRs list for namespace '{}'", namespace);
            throw new AdrNotFoundException();
        }

        return adrs;
    }

    private Document retrieveAdrDoc(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException {
        List<Document> adrsDoc = retrieveAdrsDocs(adrMeta.getNamespace());

        for (Document adrDoc : adrsDoc) {
            Integer id = adrDoc.get(ADR_ID_FIELD, Integer.class);
            if (id != null && id == adrMeta.getId()) {
                return adrDoc;
            }
        }

        LOG.warn("ADR with ID {} not found in namespace '{}'", adrMeta.getId(), adrMeta.getNamespace());
        throw new AdrNotFoundException();
    }

    private Document retrieveRevisionsDoc(Document adrDoc, AdrMeta adrMeta) throws AdrRevisionNotFoundException {
        Document revisionsDoc = adrDoc.get(REVISIONS_FIELD, Document.class);

        if (revisionsDoc == null) {
            LOG.error("Could not find revisions for ADR [{}]", adrMeta.getId());
            throw new AdrRevisionNotFoundException();
        }

        return revisionsDoc;
    }

    private AdrMeta retrieveLatestRevision(AdrMeta adrMeta, Document adrDoc) throws AdrRevisionNotFoundException, AdrParseException {
        Document revisionsDoc = retrieveRevisionsDoc(adrDoc, adrMeta);

        Set<String> fieldNames = revisionsDoc.getFields();
        int latestRevision = fieldNames.stream()
                .map(Integer::parseInt)
                .mapToInt(i -> i)
                .max()
                .orElseThrow(() -> {
                    LOG.error("No revisions found for ADR [{}]", adrMeta.getId());
                    return new AdrRevisionNotFoundException();
                });

        // Return the ADR JSON blob for the specified revision
        String adrStr = revisionsDoc.get(String.valueOf(latestRevision), String.class);
        LOG.info("RevisionDoc: [{}], Revision: [{}]", adrStr, latestRevision);

        try {
            return new AdrMeta.AdrMetaBuilder()
                    .setNamespace(adrMeta.getNamespace())
                    .setId(adrMeta.getId())
                    .setRevision(latestRevision)
                    .setAdr(objectMapper.readValue(adrStr, Adr.class))
                    .build();
        } catch (JsonProcessingException e) {
            LOG.error("Could not parse stored ADR to ADR Content.", e);
            throw new AdrParseException();
        }
    }

    private void writeAdrToNitrite(AdrMeta adrMeta) throws AdrPersistenceException, AdrParseException {
        try {
            String adrStr = objectMapper.writeValueAsString(adrMeta.getAdr());

            Filter filter = where(NAMESPACE_FIELD).eq(adrMeta.getNamespace());
            Document namespaceDoc = adrCollection.find(filter).firstOrNull();

            if (namespaceDoc != null) {
                List<Document> adrs = namespaceDoc.get(ADRS_FIELD, List.class);
                if (adrs != null) {
                    // Create a mutable copy of the list
                    adrs = new ArrayList<>(adrs);
                    for (int i = 0; i < adrs.size(); i++) {
                        Document adrDoc = adrs.get(i);
                        if (adrDoc.get(ADR_ID_FIELD, Integer.class) == adrMeta.getId()) {
                            Document revisionsDoc = adrDoc.get(REVISIONS_FIELD, Document.class);
                            revisionsDoc.put(String.valueOf(adrMeta.getRevision()), adrStr);
                            adrDoc.put(REVISIONS_FIELD, revisionsDoc);
                            adrs.set(i, adrDoc);
                            namespaceDoc.put(ADRS_FIELD, adrs);
                            adrCollection.update(filter, namespaceDoc);
                            LOG.info("Updated revision {} for ADR {} in namespace '{}'", 
                                    adrMeta.getRevision(), adrMeta.getId(), adrMeta.getNamespace());
                            return;
                        }
                    }
                }
            }

            LOG.error("Failed to update ADR [{}] - namespace or ADR not found", adrMeta);
            throw new AdrPersistenceException();
        } catch (JsonProcessingException e) {
            LOG.error("Could not write ADR Content to String", e);
            throw new AdrParseException();
        }
    }
}
