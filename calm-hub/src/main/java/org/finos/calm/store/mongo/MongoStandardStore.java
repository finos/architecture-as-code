package org.finos.calm.store.mongo;

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
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.StandardDetails;
import org.finos.calm.domain.exception.*;
import org.finos.calm.store.StandardStore;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@ApplicationScoped
@Typed(MongoStandardStore.class)
public class MongoStandardStore implements StandardStore {

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoCollection<Document> standardCollection;

    public MongoStandardStore(MongoClient mongoClient, MongoCounterStore mongoCounterStore, MongoNamespaceStore mongoNamespaceStore) {
        this.counterStore = mongoCounterStore;
        this.namespaceStore = mongoNamespaceStore;
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.standardCollection = database.getCollection("standards");
    }

    @Override
    public List<StandardDetails> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = standardCollection.find(Filters.eq("namespace", namespace)).first();

        if(namespaceDocument == null) {
            return List.of();
        }

        List<Document> standards = namespaceDocument.getList("standards", Document.class);
        List<StandardDetails> standardDetails = new ArrayList<>();

        for (Document standard : standards) {
            StandardDetails details = new StandardDetails();
            details.setName(standard.getString("name"));
            details.setDescription(standard.getString("description"));
            details.setId(standard.getInteger("standardId"));
            standardDetails.add(details);
        }

        return standardDetails;
    }

    @Override
    public Standard createStandardForNamespace(Standard standard) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(standard.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextStandardSequenceValue();
        Document standardDocument = new Document("standardId", id)
                .append("name", standard.getName())
                .append("description", standard.getDescription())
                .append("versions",
                new Document("1-0-0", Document.parse(standard.getStandardJson())));

        standardCollection.updateOne(
                Filters.eq("namespace", standard.getNamespace()),
                Updates.push("standards", standardDocument),
                new UpdateOptions().upsert(true));

        standard.setId(id);

        return standard;
    }

    @Override
    public List<String> getStandardVersions(StandardDetails standard) throws NamespaceNotFoundException, StandardNotFoundException {
        Document result = retrieveStandardVersions(standard);

        List<Document> standards = (List<Document>) result.get("standards");
        for (Document standardDoc : standards) {
            if (standard.getId().equals(standardDoc.getInteger("standardId"))) {
                // Extract the versions map from the matching standard
                Document versions = (Document) standardDoc.get("versions");
                Set<String> versionKeys = versions.keySet();

                //Convert from Mongo representation
                List<String> resourceVersions = new ArrayList<>();
                for (String versionKey : versionKeys) {
                    resourceVersions.add(versionKey.replace('-', '.'));
                }
                return resourceVersions;  // Return the list of version keys
            }
        }

        throw new StandardNotFoundException();

    }

    private Document retrieveStandardVersions(StandardDetails standard) throws NamespaceNotFoundException, StandardNotFoundException {
        if(!namespaceStore.namespaceExists(standard.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", standard.getNamespace());
        Bson projection = Projections.fields(Projections.include("standards"));

        Document result = standardCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new StandardNotFoundException();
        }

        return result;
    }

    @Override
    public String getStandardForVersion(StandardDetails standardDetails) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException {
        Document result = retrieveStandardVersions(standardDetails);
        List<Document> standards = (List<Document>) result.get("standards");
        for (Document standardDoc : standards) {
            if (standardDetails.getId().equals(standardDoc.getInteger("standardId"))) {
                Document versions = (Document) standardDoc.get("versions");
                Document versionDoc = (Document) versions.get(standardDetails.getMongoVersion());
                if(versionDoc == null) {
                    throw new StandardVersionNotFoundException();
                }
                return versionDoc.toJson();
            }
        }
        throw new StandardNotFoundException();
    }

    @Override
    public Standard createStandardForVersion(Standard standard) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        throw new UnsupportedOperationException();
    }
}
