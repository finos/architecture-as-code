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
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.Adr;
import org.finos.calm.domain.AdrBuilder;
import org.finos.calm.domain.AdrContent;
import org.finos.calm.domain.AdrContentBuilder;
import org.finos.calm.domain.AdrStatus;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrPersistenceError;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@ApplicationScoped
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
    public Adr createAdrForNamespace(Adr adr) throws NamespaceNotFoundException, JsonProcessingException {
        if(!namespaceStore.namespaceExists(adr.namespace())) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextAdrSequenceValue();
        Document adrDocument = new Document("adrId", id).append("revisions",
                new Document(String.valueOf(adr.revision()), Document.parse(objectMapper.writeValueAsString(adr.adrContent()))));

        adrCollection.updateOne(
                Filters.eq("namespace", adr.namespace()),
                Updates.push("adrs", adrDocument),
                new UpdateOptions().upsert(true));

        return AdrBuilder.builder(adr).id(id).build();
    }

    @Override
    public Adr getAdr(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        Document adrDoc = retrieveAdrDoc(adr);
        return retrieveLatestRevision(adr, adrDoc);
    }

    @Override
    public List<Integer> getAdrRevisions(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        Document adrDoc = retrieveAdrDoc(adr);
        Document revisions = retrieveRevisionsDoc(adrDoc, adr);
        return revisions.keySet()
                .stream()
                .map(Integer::parseInt)
                .toList();
    }

    @Override
    public Adr getAdrRevision(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        Document adrDoc = retrieveAdrDoc(adr);
        Document revisionsDoc = retrieveRevisionsDoc(adrDoc, adr);

        // Return the ADR JSON blob for the specified revision
        Document revisionDoc = (Document) revisionsDoc.get(String.valueOf(adr.revision()));
        log.info("RevisionDoc: [{}], Revision: [{}]", adrDoc.get("revisions"), adr.revision());
        if(revisionDoc == null) {
            throw new AdrRevisionNotFoundException();
        }
        return AdrBuilder.builder(adr)
                .adrContent(objectMapper.readValue(revisionDoc.toJson(), AdrContent.class))
                .build();
    }

    @Override
    public Adr updateAdrForNamespace(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException, AdrPersistenceError {
        Document adrDoc = retrieveAdrDoc(adr);
        Adr latestRevision = retrieveLatestRevision(adr, adrDoc);

        int newRevision = latestRevision.revision() + 1;
        Adr newAdr = AdrBuilder.builder(adr)
                .adrContent(AdrContentBuilder.builder(adr.adrContent())
                        .status(latestRevision.adrContent().status())
                        .creationDateTime(latestRevision.adrContent().creationDateTime())
                        .build())
                .revision(newRevision)
                .build();

        writeAdrToMongo(newAdr);
        return newAdr;
    }

    @Override
    public Adr updateAdrStatus(Adr adr, AdrStatus adrStatus) throws AdrNotFoundException, NamespaceNotFoundException, AdrRevisionNotFoundException, JsonProcessingException, AdrPersistenceError {
        Document adrDoc = retrieveAdrDoc(adr);
        Adr latestRevision = retrieveLatestRevision(adr, adrDoc);

        int newRevisionNum = latestRevision.revision() + 1;
        Adr newRevision = AdrBuilder.builder(latestRevision)
                .revision(newRevisionNum)
                .adrContent(AdrContentBuilder.builder(latestRevision.adrContent())
                        .status(adrStatus)
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

    private Document retrieveAdrDoc(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException {
        List<Document> adrsDoc = retrieveAdrsDocs(adr.namespace());
        Optional<Document> adrOpt = adrsDoc.stream().filter(adrDoc -> adr.id() == adrDoc.getInteger("adrId")).findAny();
        return adrOpt.orElseThrow(AdrNotFoundException::new);
    }

    private Document retrieveRevisionsDoc(Document adrDoc, Adr adr) throws AdrRevisionNotFoundException {
        Document revisionsDoc = (Document) adrDoc.get("revisions");

        if(revisionsDoc == null || revisionsDoc.isEmpty()) {
            log.error("Could not find the latest revision of ADR [{}]", adr.id());
            throw new AdrRevisionNotFoundException();
        }

        return revisionsDoc;
    }

    private Adr retrieveLatestRevision(Adr adr, Document adrDoc) throws AdrRevisionNotFoundException, JsonProcessingException {
        Document revisionsDoc = retrieveRevisionsDoc(adrDoc, adr);

        Set<String> revisionKeys = revisionsDoc.keySet();
        int latestRevision = revisionKeys.stream()
                .map(Integer::parseInt)
                .mapToInt(i -> i)
                .max()
                .getAsInt();

        // Return the ADR JSON blob for the specified revision
        Document revisionDoc = (Document) revisionsDoc.get(String.valueOf(latestRevision));
        log.info("RevisionDoc: [{}], Revision: [{}]", revisionDoc, latestRevision);
        return AdrBuilder.builder()
                .namespace(adr.namespace())
                .id(adr.id())
                .revision(latestRevision)
                .adrContent(objectMapper.readValue(revisionDoc.toJson(), AdrContent.class))
                .build();
    }

    private void writeAdrToMongo(Adr adr) throws JsonProcessingException, AdrPersistenceError {

        Document adrDocument = Document.parse(objectMapper.writeValueAsString(adr.adrContent()));
        Document filter = new Document("namespace", adr.namespace())
                .append("adrs.adrId", adr.id());
        Document update = new Document("$set",
                new Document("adrs.$.revisions." + adr.revision(), adrDocument));

        try {
            adrCollection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch(MongoWriteException ex) {
            log.error("Failed to write ADR to mongo [{}]", adr, ex);
            throw new AdrPersistenceError();
        }
    }
}
