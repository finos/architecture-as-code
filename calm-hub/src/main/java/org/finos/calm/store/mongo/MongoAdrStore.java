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
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
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
        List<Integer> adrIds = new ArrayList<>();

        for (Document adr : adrs) {
            adrIds.add(adr.getInteger("adrId"));
        }

        return adrIds;
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
    public String getAdr(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        Document result = retrieveAdrRevisions(adr);
        List<Document> adrs = (List<Document>) result.get("adrs");
        for (Document adrDoc : adrs) {
            if (adr.id() == adrDoc.getInteger("adrId")) {
                // Extract the revisions map from the matching adrContent
                Document revisions = (Document) adrDoc.get("revisions");
                int latestRevision = getLatestRevision(adr, revisions);

                // Return the ADR JSON blob for the specified revision
                Document revisionDoc = (Document) revisions.get(String.valueOf(latestRevision));
                log.info("RevisionDoc: [{}], Revision: [{}]", adrDoc.get("revisions"), latestRevision);
                return revisionDoc.toJson();
            }
        }
        throw new AdrNotFoundException();
    }

    private int getLatestRevision(Adr adr, Document revisionsDoc) throws AdrRevisionNotFoundException {
        if(revisionsDoc == null || revisionsDoc.isEmpty()) {
            log.error("Could not find the latest revision of ADR [{}]", adr.id());
            throw new AdrRevisionNotFoundException();
        }

        Set<String> revisionKeys = revisionsDoc.keySet();
        return revisionKeys.stream()
                .map(Integer::parseInt)
                .mapToInt(i -> i)
                .max()
                .getAsInt();
    }

    @Override
    public List<Integer> getAdrRevisions(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException {
        Document result = retrieveAdrRevisions(adr);

        List<Document> adrs = (List<Document>) result.get("adrs");
        for (Document adrDoc : adrs) {
            if (adr.id() == adrDoc.getInteger("adrId")) {
                // Extract the revisions map from the matching adrContent
                Document revisions = (Document) adrDoc.get("revisions");
                Set<String> revisionKeys = revisions.keySet();

                return revisionKeys.stream().map(Integer::parseInt).toList();
            }
        }

        throw new AdrNotFoundException();
    }

    @Override
    public String getAdrRevision(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        Document result = retrieveAdrRevisions(adr);

        List<Document> adrs = (List<Document>) result.get("adrs");
        for (Document adrDoc : adrs) {
            if (adr.id() == adrDoc.getInteger("adrId")) {
                // Retrieve the revisions map from the matching adrContent
                Document revisions = (Document) adrDoc.get("revisions");

                if(revisions == null || revisions.isEmpty()) {
                    //ADR Revisions collection not initialized
                    throw new AdrRevisionNotFoundException();
                }

                // Return the ADR JSON blob for the specified revision
                Document revisionDoc = (Document) revisions.get(String.valueOf(adr.revision()));
                log.info("RevisionDoc: [{}], Revision: [{}]", adrDoc.get("revisions"), adr.revision());
                if(revisionDoc == null) {
                    throw new AdrRevisionNotFoundException();
                }
                return revisionDoc.toJson();
            }
        }
        //ADR Revisions is empty, no revisions to find
        throw new AdrRevisionNotFoundException();
    }

    @Override
    public Adr updateAdrForNamespace(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        Document result = retrieveAdrRevisions(adr);
        List<Document> adrs = (List<Document>) result.get("adrs");
        for (Document adrDoc : adrs) {
            if (adr.id() == adrDoc.getInteger("adrId")) {
                // Extract the revisions map from the matching adrContent
                Document revisions = (Document) adrDoc.get("revisions");
                int latestRevision = getLatestRevision(adr, revisions);
                Document revisionDoc = (Document) revisions.get(String.valueOf(latestRevision));
                AdrContent latestAdrContent = objectMapper.readValue(revisionDoc.toJson(), AdrContent.class);
                AdrContent newAdrContent = AdrContentBuilder.builder(adr.adrContent())
                        .status(latestAdrContent.status())
                        .creationDateTime(latestAdrContent.creationDateTime())
                        .build();

                Adr newAdr = AdrBuilder.builder(adr).adrContent(newAdrContent).revision(latestRevision + 1).build();

                writeAdrToMongo(newAdr);
                return newAdr;

            }
        }
        throw new AdrNotFoundException();
    }

    private Document retrieveAdrRevisions(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException {
        if(!namespaceStore.namespaceExists(adr.namespace())) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", adr.namespace());
        Bson projection = Projections.fields(Projections.include("adrs"));

        Document result = adrCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new AdrNotFoundException();
        }

        return result;
    }

    private void writeAdrToMongo(Adr adr) throws AdrNotFoundException, JsonProcessingException {

        Document adrDocument = Document.parse(objectMapper.writeValueAsString(adr.adrContent()));
        Document filter = new Document("namespace", adr.namespace())
                .append("adrs.adrId", adr.id());
        Document update = new Document("$set",
                new Document("adrs.$.revisions." + adr.revision(), adrDocument));

        try {
            adrCollection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch (MongoWriteException ex) {
            log.error("Failed to write ADR to mongo [{}]", adr, ex);
            throw new AdrNotFoundException();
        }
    }
}
