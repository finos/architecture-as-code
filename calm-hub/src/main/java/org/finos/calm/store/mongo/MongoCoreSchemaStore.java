package org.finos.calm.store.mongo;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.store.CoreSchemaStore;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class MongoCoreSchemaStore implements CoreSchemaStore {

    private final MongoCollection<Document> schemaCollection;

    public MongoCoreSchemaStore(MongoClient mongoClient) {
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
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
            return document.get("schemas", Map.class);  // Get the 'schemas' field as a map
        }

        return null;
    }
}
