package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
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
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.pattern.NamespacePatternSummary;
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

    public MongoPatternStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.patternCollection = database.getCollection("patterns");
    }

    @Override
    public List<NamespacePatternSummary> getPatternsForNamespace(String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = patternCollection.find(Filters.eq("namespace", namespace)).first();

        //protects from an unpopulated mongo collection
        if(namespaceDocument == null || namespaceDocument.isEmpty()) {
            return List.of();
        }

        List<Document> patterns = namespaceDocument.getList("patterns", Document.class);
        List<NamespacePatternSummary> patternSummaries = new ArrayList<>();

        for (Document pattern : patterns) {
            Integer patternId = pattern.getInteger("patternId");
            String name = pattern.getString("name");
            String description = pattern.getString("description");
            if (name == null) name = "Pattern " + patternId;
            if (description == null) description = "";
            patternSummaries.add(new NamespacePatternSummary(name, description, patternId));
        }

        return patternSummaries;
    }

    @Override
    public Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
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

        Pattern persistedPattern = new Pattern.PatternBuilder()
                .setId(id)
                .setVersion("1.0.0")
                .setNamespace(namespace)
                .setPattern(patternRequest.getPatternJson())
                .build();

        return persistedPattern;
    }

    @Override
    public List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        Document result = retrievePatternVersions(pattern);

        List<Document> patterns = result.getList("patterns", Document.class);
        for (Document patternDoc : patterns) {
            if (pattern.getId() == patternDoc.getInteger("patternId")) {
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

    private Document retrievePatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        if(!namespaceStore.namespaceExists(pattern.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", pattern.getNamespace());
        Bson projection = Projections.fields(Projections.include("patterns"));

        Document result = patternCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new PatternNotFoundException();
        }

        return result;
    }

    @Override
    public String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        Document result = retrievePatternVersions(pattern);

        List<Document> patterns = result.getList("patterns", Document.class);
        for (Document patternDoc : patterns) {
            if (pattern.getId() == patternDoc.getInteger("patternId")) {
                // Retrieve the versions map from the matching pattern
                Document versions = (Document) patternDoc.get("versions");

                // Return the pattern JSON blob for the specified version
                Document versionDoc = (Document) versions.get(pattern.getMongoVersion());
                log.info("VersionDoc: [{}], Mongo Version: [{}]", patternDoc.get("versions"), pattern.getMongoVersion());
                if(versionDoc == null) {
                    throw new PatternVersionNotFoundException();
                }
                return versionDoc.toJson();
            }
        }
        //Patterns is empty, no version to find
        throw new PatternVersionNotFoundException();
    }

    @Override
    public Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException {
        // Validates namespace and pattern existence
        getPatternVersions(pattern);

        // Atomic conditional update: only succeeds if the version doesn't already exist
        Document filter = new Document("namespace", pattern.getNamespace())
                .append("patterns", new Document("$elemMatch",
                        new Document("patternId", pattern.getId())
                                .append("versions." + pattern.getMongoVersion(), new Document("$exists", false))));

        Document update = new Document("$set",
                new Document("patterns.$.versions." + pattern.getMongoVersion(), Document.parse(pattern.getPatternJson())));

        if (patternCollection.updateOne(filter, update).getMatchedCount() == 0) {
            throw new PatternVersionExistsException();
        }

        return pattern;
    }

    @Override
    public Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException {
        if(!namespaceStore.namespaceExists(pattern.getNamespace())) {
            throw new NamespaceNotFoundException();
        }
        writePatternToMongo(pattern);
        return pattern;
    }

    private void writePatternToMongo(Pattern pattern) throws PatternNotFoundException, NamespaceNotFoundException {
        retrievePatternVersions(pattern);

        Document patternDocument = Document.parse(pattern.getPatternJson());
        Document filter = new Document("namespace", pattern.getNamespace())
                .append("patterns.patternId", pattern.getId());
        Document update = new Document("$set",
                new Document("patterns.$.versions." + pattern.getMongoVersion(), patternDocument));

        try {
            patternCollection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch (MongoWriteException ex) {
            log.error("Failed to write pattern to mongo [{}]", pattern, ex);
            throw new PatternNotFoundException();
        }
    }

}