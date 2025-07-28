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
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.patterns.CreatePatternRequest;
import org.finos.calm.store.PatternStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@ApplicationScoped
@Typed(MongoPatternStore.class)
public class MongoPatternStore implements PatternStore {
    private final MongoCollection<Document> patternCollection;
    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoPatternStore(MongoClient mongoClient, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.patternCollection = database.getCollection("patterns");
    }

    @Override
    public List<Integer> getPatternsForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = patternCollection.find(Filters.eq("namespace", namespace)).first();

        //protects from an unpopulated mongo collection
        if (namespaceDocument == null || namespaceDocument.isEmpty()) {
            return List.of();
        }

        List<Document> patterns = namespaceDocument.getList("patterns", Document.class);
        List<Integer> patternIds = new ArrayList<>();

        for (Document pattern : patterns) {
            patternIds.add(pattern.getInteger("patternId"));
        }

        return patternIds;
    }

    @Override
    public Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException {
        Pattern createdPattern = new Pattern(patternRequest);
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextPatternSequenceValue();
        Document patternDocument = new Document("patternId", id)
                .append("name", patternRequest.getName())
                .append("description", patternRequest.getDescription())
                .append("versions",
                        new Document("1-0-0", Document.parse(patternRequest.getPatternJson())));

        patternCollection.updateOne(
                Filters.eq("namespace", namespace),
                Updates.push("patterns", patternDocument),
                new UpdateOptions().upsert(true));

        createdPattern.setId(id);
        createdPattern.setVersion("1.0.0");

        return createdPattern;
    }

    @Override
    public List<String> getPatternVersions(String namespace, Integer patternId) throws NamespaceNotFoundException, PatternNotFoundException {
        Document result = retrievePatternVersions(namespace);

        List<Document> patterns = (List<Document>) result.get("patterns");
        for (Document patternDoc : patterns) {
            if (patternId == patternDoc.getInteger("patternId")) {
                // Extract the versions map from the matching pattern
                Document versions = (Document) patternDoc.get("versions");
                Set<String> versionKeys = versions.keySet();

                //Convert from Mongo representation
                List<String> resourceVersions = new ArrayList<>();
                for (String versionKey : versionKeys) {
                    resourceVersions.add(versionKey.replace('-', '.'));
                }
                return resourceVersions;  // Return the list of version keys
            }
        }

        throw new PatternNotFoundException();
    }

    private Document retrievePatternVersions(String namespace) throws NamespaceNotFoundException, PatternNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", namespace);
        Bson projection = Projections.fields(Projections.include("patterns"));

        Document result = patternCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new PatternNotFoundException();
        }

        return result;
    }

    @Override
    public String getPatternForVersion(String namespace, Integer patternId, String version) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        Document result = retrievePatternVersions(namespace);

        List<Document> patterns = (List<Document>) result.get("patterns");
        Pattern pattern = new Pattern();
        for (Document patternDoc : patterns) {
            if (patternId == patternDoc.getInteger("patternId")) {
                // Retrieve the versions map from the matching pattern
                Document versions = (Document) patternDoc.get("versions");

                // Return the pattern JSON blob for the specified version
                Document versionDoc = (Document) versions.get(version.replace('.', '-'));
                log.info("VersionDoc: [{}], Mongo Version: [{}]", patternDoc.get("versions"), pattern.getMongoVersion());
                if (versionDoc == null) {
                    throw new PatternVersionNotFoundException();
                }
                pattern.setNamespace(namespace);
                pattern.setVersion(version);
                pattern.setId(patternId);
                pattern.setPatternJson(versionDoc.toJson());
                return pattern;
            }
        }
        //Patterns is empty, no version to find
        throw new PatternVersionNotFoundException();
    }

    @Override
    public Pattern createPatternForVersion(CreatePatternRequest patternRequest, String namespace, Integer patternId, String version) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        if (versionExists(namespace, patternId, version)) {
            throw new PatternVersionExistsException();
        }

        return writePatternToMongo(patternRequest, namespace, patternId, version);
    }

    @Override
    public Pattern updatePatternForVersion(CreatePatternRequest patternRequest, String namespace, Integer patternId, String version) throws NamespaceNotFoundException, PatternNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }
        return writePatternToMongo(patternRequest, namespace, patternId, version);
    }

    private Pattern writePatternToMongo(CreatePatternRequest createPatternRequest, String namespace, Integer patternId, String version) throws PatternNotFoundException, NamespaceNotFoundException {
        retrievePatternVersions(namespace);

        Document patternDocument = Document.parse(createPatternRequest.getPatternJson());
        Document filter = new Document("namespace", namespace)
                .append("patterns.patternId", patternId);
        Document update = new Document("$set", new Document()
                .append("pattern.$.name", createPatternRequest.getName())
                .append("pattern.$.description", createPatternRequest.getDescription())
                .append("patterns.$.versions." + version.replace('.', '-'), patternDocument));

        try {
            patternCollection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch (MongoWriteException ex) {
            log.error("Failed to write pattern to mongo [{}]", pattern, ex);
            throw new PatternNotFoundException();
        }
        Pattern pattern = new Pattern(createPatternRequest);
        pattern.setId(patternId);
        pattern.setVersion(version);
        return pattern;
    }

    private boolean versionExists(String namespace, Integer patternId, String version) {
        Document filter = new Document("namespace", namespace).append("patterns.patternId", patternId);
        Bson projection = Projections.fields(Projections.include("patterns.versions." + patternId));
        Document result = patternCollection.find(filter).projection(projection).first();

        if (result != null) {
            List<Document> patterns = (List<Document>) result.get("patterns");
            for (Document patternDoc : patterns) {
                Document versions = (Document) patternDoc.get("versions");
                if (versions != null && versions.containsKey(version.replace('.', '-'))) {
                    return true;  // The version already exists
                }
            }
        }
        return false;
    }
}