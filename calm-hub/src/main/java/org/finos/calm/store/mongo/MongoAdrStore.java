package org.finos.calm.store.mongo;

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
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
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
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoAdrStore(MongoClient mongoClient, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.adrCollection = database.getCollection("adrs");
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

        List<Document> patterns = namespaceDocument.getList("adrs", Document.class);
        List<Integer> adrIds = new ArrayList<>();

        for (Document pattern : patterns) {
            adrIds.add(pattern.getInteger("adrId"));
        }

        return adrIds;
    }

    @Override
    public Adr createAdrForNamespace(Adr adr) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(adr.namespace())) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextAdrSequenceValue();
        Document adrDocument = new Document("adrId", id).append("revisions",
                new Document(String.valueOf(adr.revision()), Document.parse(adr.adr())));

        adrCollection.updateOne(
                Filters.eq("namespace", adr.namespace()),
                Updates.push("adrs", adrDocument),
                new UpdateOptions().upsert(true));

         return AdrBuilder.builder(adr).id(id).build();
    }

    @Override
    public List<Integer> getAdrRevisions(Adr adr) throws NamespaceNotFoundException, AdrNotFoundException {
        Document result = retrieveAdrRevisions(adr);

        List<Document> adrs = (List<Document>) result.get("adrs");
        for (Document adrDoc : adrs) {
            if (adr.id() == adrDoc.getInteger("adrId")) {
                // Extract the revisions map from the matching pattern
                Document revisions = (Document) adrDoc.get("revisions");
                Set<String> revisionKeys = revisions.keySet();

                return revisionKeys.stream().map(Integer::parseInt).toList();
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
}
