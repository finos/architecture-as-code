package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.store.CoreSchemaStore;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
@Typed(MongoCoreSchemaStore.class)
public class MongoCoreSchemaStore implements CoreSchemaStore {

    private final MongoCollection<Document> schemaCollection;

    public MongoCoreSchemaStore(MongoDatabase database) {
        this.schemaCollection = database.getCollection("schemas");
    }

    @Override
    public List<String> getVersions() {
        List<String> versions = new ArrayList<>();
        for (Document doc : schemaCollection.find()) {
            versions.add(doc.getString("version"));
        }
        return versions;
    }

    @Override
    public Map<String, Object> getSchemasForVersion(String version) {
        Bson filter = Filters.eq("version", version);
        Document document = schemaCollection.find(filter).first();

        if (document != null) {
            Map<?, ?> rawMap = document.get("schemas", Map.class);
            Map<String, Object> typedMap = new HashMap<>();
            if (rawMap != null) {
                // Convert entries ensuring keys are Strings. Values can be any Object (schemas themselves
                // are typically nested Maps representing JSON Schema documents). Previous implementation
                // incorrectly iterated over entrySet and attempted to cast Map.Entry to Map, producing
                // an always-empty result. This corrected logic simply copies the mapping.
                for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
                    Object key = entry.getKey();
                    if (key instanceof String) {
                        typedMap.put((String) key, entry.getValue());
                    }
                }
            }
            return typedMap;
        }

        return null;
    }

    @Override
    public void createSchemaVersion(String version, Map<String, Object> schemas) {
        // Check if version already exists
        Bson filter = Filters.eq("version", version);
        Document existingDoc = schemaCollection.find(filter).first();
        
        if (existingDoc == null) {
            Document schemaDoc = new Document()
                    .append("version", version)
                    .append("schemas", schemas);
            schemaCollection.insertOne(schemaDoc);
        }
    }
}
