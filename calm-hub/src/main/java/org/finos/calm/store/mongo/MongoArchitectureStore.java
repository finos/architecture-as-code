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
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@ApplicationScoped
@Typed(MongoArchitectureStore.class)
public class MongoArchitectureStore implements ArchitectureStore {

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoCollection<Document> architectureCollection;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoArchitectureStore(MongoClient mongoClient, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.architectureCollection = database.getCollection("architectures");
    }

    @Override
    public List<Integer> getArchitecturesForNamespace(String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = architectureCollection.find(Filters.eq("namespace", namespace)).first();

        //protects from an unpopulated mongo collection
        if(namespaceDocument == null || namespaceDocument.isEmpty()) {
            return List.of();
        }

        List<Document> patterns = namespaceDocument.getList("architectures", Document.class);
        List<Integer> architectureIds = new ArrayList<>();

        for (Document pattern : patterns) {
            architectureIds.add(pattern.getInteger("architectureId"));
        }

        return architectureIds;
    }

    @Override
    public Architecture createArchitectureForNamespace(Architecture architecture) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(architecture.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextArchitectureSequenceValue();
        Document architectureDocument = new Document("architectureId", id).append("versions",
                new Document("1-0-0", Document.parse(architecture.getArchitectureJson())));

        architectureCollection.updateOne(
                Filters.eq("namespace", architecture.getNamespace()),
                Updates.push("architectures", architectureDocument),
                new UpdateOptions().upsert(true));

        Architecture persistedArchitecture = new Architecture.ArchitectureBuilder()
                .setId(id)
                .setVersion("1.0.0")
                .setNamespace(architecture.getNamespace())
                .setArchitecture(architecture.getArchitectureJson())
                .build();

        return persistedArchitecture;
    }

    @Override
    public List<String> getArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        Document result = retrieveArchitectureVersions(architecture);

        List<Document> architectures = (List<Document>) result.get("architectures");
        for (Document architectureDoc : architectures) {
            if (architecture.getId() == architectureDoc.getInteger("architectureId")) {
                // Extract the versions map from the matching pattern
                Document versions = (Document) architectureDoc.get("versions");
                Set<String> versionKeys = versions.keySet();

                //Convert from Mongo representation
                List<String> resourceVersions = new ArrayList<>();
                for (String versionKey : versionKeys) {
                    resourceVersions.add(versionKey.replace('-', '.'));
                }
                return resourceVersions;  // Return the list of version keys
            }
        }

        throw new ArchitectureNotFoundException();
    }

    private Document retrieveArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        if(!namespaceStore.namespaceExists(architecture.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", architecture.getNamespace());
        Bson projection = Projections.fields(Projections.include("architectures"));

        Document result = architectureCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new ArchitectureNotFoundException();
        }

        return result;
    }

    @Override
    public String getArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionNotFoundException {
        Document result = retrieveArchitectureVersions(architecture);

        List<Document> architectures = (List<Document>) result.get("architectures");
        for (Document architectureDoc : architectures) {
            if (architecture.getId() == architectureDoc.getInteger("architectureId")) {
                // Retrieve the versions map from the matching pattern
                Document versions = (Document) architectureDoc.get("versions");

                // Return the pattern JSON blob for the specified version
                Document versionDoc = (Document) versions.get(architecture.getMongoVersion());
                log.info("VersionDoc: [{}], Mongo Version: [{}]", architectureDoc.get("versions"), architecture.getMongoVersion());
                if(versionDoc == null) {
                    throw new ArchitectureVersionNotFoundException();
                }
                return versionDoc.toJson();
            }
        }
        //Patterns is empty, no version to find
        throw new ArchitectureVersionNotFoundException();
    }

    @Override
    public Architecture createArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException {
        if(!namespaceStore.namespaceExists(architecture.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        if(versionExists(architecture)) {
            throw new ArchitectureVersionExistsException();
        }

        writeArchitectureToMongo(architecture);
        return architecture;
    }

    @Override
    public Architecture updateArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        if(!namespaceStore.namespaceExists(architecture.getNamespace())) {
            throw new NamespaceNotFoundException();
        }
        writeArchitectureToMongo(architecture);
        return architecture;
    }

    private void writeArchitectureToMongo(Architecture architecture) throws ArchitectureNotFoundException, NamespaceNotFoundException {
        retrieveArchitectureVersions(architecture);

        Document architectureDocument = Document.parse(architecture.getArchitectureJson());
        Document filter = new Document("namespace", architecture.getNamespace())
                .append("architectures.architectureId", architecture.getId());
        Document update = new Document("$set",
                new Document("architectures.$.versions." + architecture.getMongoVersion(), architectureDocument));

        try {
            architectureCollection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch (MongoWriteException ex) {
            log.error("Failed to write architecture to mongo [{}]", architecture, ex);
            throw new ArchitectureNotFoundException();
        }
    }

    private boolean versionExists(Architecture architecture) {
        Document filter = new Document("namespace", architecture.getNamespace()).append("architectures.architectureId", architecture.getId());
        Bson projection = Projections.fields(Projections.include("architectures.versions." + architecture.getMongoVersion()));
        Document result = architectureCollection.find(filter).projection(projection).first();

        if (result != null) {
            List<Document> architectures = (List<Document>) result.get("architectures");
            for (Document architectureDoc : architectures) {
                Document versions = (Document) architectureDoc.get("versions");
                if (versions != null && versions.containsKey(architecture.getMongoVersion())) {
                    return true;  // The version already exists
                }
            }
        }
        return false;
    }
}
