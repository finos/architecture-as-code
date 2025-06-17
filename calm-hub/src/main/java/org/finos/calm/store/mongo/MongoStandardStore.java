package org.finos.calm.store.mongo;

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
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.StandardDetails;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.standards.NamespaceStandardSummary;
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
    public List<NamespaceStandardSummary> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = standardCollection.find(Filters.eq("namespace", namespace)).first();

        if(namespaceDocument == null) {
            return List.of();
        }

        List<Document> standards = namespaceDocument.getList("standards", Document.class);
        List<NamespaceStandardSummary> namespaceStanadardSummary = new ArrayList<>();

        for (Document standard : standards) {
            NamespaceStandardSummary standardSummary = new NamespaceStandardSummary(
                    standard.getString("name"),
                    standard.getString("description"),
                    standard.getInteger("standardId")
            );

            namespaceStanadardSummary.add(standardSummary);
        }

        return namespaceStanadardSummary;
    }

    @Override
    public Standard createStandardForNamespace(CreateStandardRequest standardRequest, String namespace) throws NamespaceNotFoundException {
        Standard createdStandard = new Standard(standardRequest);
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextStandardSequenceValue();
        Document standardDocument = new Document("standardId", id)
                .append("name", standardRequest.getName())
                .append("description", standardRequest.getDescription())
                .append("versions",
                new Document("1-0-0", Document.parse(standardRequest.getStandardJson())));

        standardCollection.updateOne(
                Filters.eq("namespace", namespace),
                Updates.push("standards", standardDocument),
                new UpdateOptions().upsert(true));

        createdStandard.setId(id);
        createdStandard.setVersion("1.0.0");

        return createdStandard;
    }

    @Override
    public List<String> getStandardVersions(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException {
        Document result = retrieveStandardVersions(namespace, standardId);

        List<Document> standards = (List<Document>) result.get("standards");
        for (Document standardDoc : standards) {
            if (standardId.equals(standardDoc.getInteger("standardId"))) {
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

    private Document retrieveStandardVersions(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException {
        //FIXME there is a bug here where standardId is not used, which will be fine when one standard exists

        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", namespace);
        Bson projection = Projections.fields(Projections.include("standards"));

        Document result = standardCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new StandardNotFoundException();
        }

        return result;
    }

    @Override
    public Standard getStandardForVersion(String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException {
        Document result = retrieveStandardVersions(namespace, standardId);
        List<Document> standards = (List<Document>) result.get("standards");
        Standard standard = new Standard();
        for (Document standardDoc : standards) {
            if (standardId.equals(standardDoc.getInteger("standardId"))) {
                Document versions = (Document) standardDoc.get("versions");
                Document versionDoc = (Document) versions.get(version.replace('.', '-'));
                if(versionDoc == null) {
                    throw new StandardVersionNotFoundException();
                }
                //FIXME Populate the full standard
                return standard;
            }
        }
        throw new StandardNotFoundException();
    }

    @Override
    public Standard createStandardForVersion(CreateStandardRequest standardRequest, String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        if(versionExists(namespace, standardId, version)) {
            throw new StandardVersionExistsException();
        }

        return writeStandardToMongo(standardRequest, namespace, standardId, version);
    }

    private Standard writeStandardToMongo(CreateStandardRequest createStandardRequest, String namespace, Integer standardId, String version) throws StandardNotFoundException, NamespaceNotFoundException {
        retrieveStandardVersions(namespace, standardId);

        Document standardDocument = Document.parse(createStandardRequest.getStandardJson());
        Document filter = new Document("namespace", namespace)
                .append("standards.standardId", standardId);

        Document update = new Document("$set", new Document()
                .append("standards.$.name", createStandardRequest.getName())
                .append("standards.$.description", createStandardRequest.getDescription())
                .append("standards.$.versions." + version.replace('.', '-'), standardDocument));

        try {
            standardCollection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch (MongoWriteException ex) {
            throw new StandardNotFoundException();
        }
        Standard standard = new Standard(createStandardRequest);
        standard.setId(standardId);
        standard.setVersion(version);
        return standard;
    }

    private boolean versionExists(String namespace, Integer standardId, String version) {
        Document filter = new Document("namespace", namespace).append("standards.standardId", standardId);
        Bson projection = Projections.fields(Projections.include("standards.versions." + standardId));
        Document result = standardCollection.find(filter).projection(projection).first();

        if(result != null) {
            List<Document> standards = (List<Document>) result.get("standards");
            for (Document standardDoc : standards) {
                Document versions = (Document) standardDoc.get("versions");
                if (versions != null && versions.containsKey(version.replace('.', '-'))) {
                    return true;  // The version already exists
                }
            }
        }
        return false;
    }
}
