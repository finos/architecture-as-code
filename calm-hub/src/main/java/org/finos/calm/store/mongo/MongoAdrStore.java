package org.finos.calm.store.mongo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoClient;
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
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.*;
import org.finos.calm.store.AdrStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@ApplicationScoped
@Typed(MongoAdrStore.class)
public class MongoAdrStore implements AdrStore {

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoCollection<Document> adrCollection;
    private final ObjectMapper objectMapper;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoAdrStore(MongoClient mongoClient, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.adrCollection = database.getCollection("adrs");
        this.objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Override
    public List<Integer> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = adrCollection.find(Filters.eq("namespace", namespace)).first();

        //protects from an unpopulated mongo collection
        if(namespaceDocument == null || namespaceDocument.isEmpty()) {
            return List.of();
        }

        List<Document> adrs = namespaceDocument.getList("adrs", Document.class);

        return adrs.stream().map(adr -> adr.getInteger("adrId")).toList();
    }

    @Override
    public AdrMeta createAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrParseException {
        if(!namespaceStore.namespaceExists(adrMeta.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        String adrStr;
        try {
        adrStr = objectMapper.writeValueAsString(adrMeta.getAdr());
        } catch(JsonProcessingException e) {
            log.error("Could not write ADR Content to String", e);
            throw new AdrParseException();
        }

        int id = counterStore.getNextAdrSequenceValue();
        Document adrDocument = new Document("adrId", id).append("revisions",
                new Document(String.valueOf(adrMeta.getRevision()), Document.parse(adrStr)));

        adrCollection.updateOne(
                Filters.eq("namespace", adrMeta.getNamespace()),
                Updates.push("adrs", adrDocument),
                new UpdateOptions().upsert(true));

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
        return revisions.keySet()
                .stream()
                .map(Integer::parseInt)
                .toList();
    }

    @Override
    public AdrMeta getAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        Document adrDoc = retrieveAdrDoc(adrMeta);
        Document revisionsDoc = retrieveRevisionsDoc(adrDoc, adrMeta);

        // Return the ADR JSON blob for the specified revision
        Document revisionDoc = (Document) revisionsDoc.get(String.valueOf(adrMeta.getRevision()));
        log.info("RevisionDoc: [{}], Revision: [{}]", adrDoc.get("revisions"), adrMeta.getRevision());
        if(revisionDoc == null) {
            throw new AdrRevisionNotFoundException();
        }
        try {
            return new AdrMeta.AdrMetaBuilder(adrMeta)
                    .setAdr(objectMapper.readValue(revisionDoc.toJson(), Adr.class))
                    .build();
        } catch(JsonProcessingException e) {
            log.error("Could not parse stored ADR to ADR Content.", e);
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

        writeAdrToMongo(newAdrMeta);
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
        writeAdrToMongo(newRevision);
        return newRevision;
    }

    private List<Document> retrieveAdrsDocs(String namespace) throws NamespaceNotFoundException, AdrNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", namespace);
        Bson projection = Projections.fields(Projections.include("adrs"));

        Document result = adrCollection.find(filter).projection(projection).first();

        if(result == null) {
            throw new AdrNotFoundException();
        }

        return (List<Document>) result.get("adrs");
    }

    private Document retrieveAdrDoc(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException {
        List<Document> adrsDoc = retrieveAdrsDocs(adrMeta.getNamespace());
        Optional<Document> adrOpt = adrsDoc.stream().filter(adrDoc -> adrMeta.getId() == adrDoc.getInteger("adrId")).findAny();
        return adrOpt.orElseThrow(AdrNotFoundException::new);
    }

    private Document retrieveRevisionsDoc(Document adrDoc, AdrMeta adrMeta) throws AdrRevisionNotFoundException {
        Document revisionsDoc = (Document) adrDoc.get("revisions");

        if(revisionsDoc == null || revisionsDoc.isEmpty()) {
            log.error("Could not find the latest revision of ADR [{}]", adrMeta.getId());
            throw new AdrRevisionNotFoundException();
        }

        return revisionsDoc;
    }

    private AdrMeta retrieveLatestRevision(AdrMeta adrMeta, Document adrDoc) throws AdrRevisionNotFoundException, AdrParseException {
        Document revisionsDoc = retrieveRevisionsDoc(adrDoc, adrMeta);

        Set<String> revisionKeys = revisionsDoc.keySet();
        int latestRevision = revisionKeys.stream()
                .map(Integer::parseInt)
                .mapToInt(i -> i)
                .max()
                .getAsInt();

        // Return the ADR JSON blob for the specified revision
        Document revisionDoc = (Document) revisionsDoc.get(String.valueOf(latestRevision));
        log.info("RevisionDoc: [{}], Revision: [{}]", revisionDoc, latestRevision);
        try {
            return new AdrMeta.AdrMetaBuilder()
                    .setNamespace(adrMeta.getNamespace())
                    .setId(adrMeta.getId())
                    .setRevision(latestRevision)
                    .setAdr(objectMapper.readValue(revisionDoc.toJson(), Adr.class))
                    .build();
        } catch(JsonProcessingException e) {
            log.error("Could not parse stored ADR to ADR Content.", e);
            throw new AdrParseException();
        }
    }

    private void writeAdrToMongo(AdrMeta adrMeta) throws AdrPersistenceException, AdrParseException {

        try {
            Document adrDocument = Document.parse(objectMapper.writeValueAsString(adrMeta.getAdr()));
            Document filter = new Document("namespace", adrMeta.getNamespace())
                    .append("adrs.adrId", adrMeta.getId());
            Document update = new Document("$set",
                    new Document("adrs.$.revisions." + adrMeta.getRevision(), adrDocument));

            adrCollection.updateOne(filter, update, new UpdateOptions().upsert(true));

        } catch(MongoWriteException ex) {
            log.error("Failed to write ADR to mongo [{}]", adrMeta, ex);
            throw new AdrPersistenceException();
        } catch(JsonProcessingException e) {
            log.error("Could not write ADR Content to String", e);
            throw new AdrParseException();
        }

    }
}
