package org.finos.calm.store.mongo;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.store.NamespaceStore;

import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
@Typed(MongoNamespaceStore.class)
public class MongoNamespaceStore implements NamespaceStore {

    private final MongoCollection<Document> namespaceCollection;

    public MongoNamespaceStore(MongoClient mongoClient) {
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.namespaceCollection = database.getCollection("namespaces");
    }

    @Override
    public List<String> getNamespaces() {
        List<String> namespaces = new ArrayList<>();
        for (Document doc : namespaceCollection.find()) {
            namespaces.add(doc.getString("namespace"));
        }
        return namespaces;
    }

    @Override
    public boolean namespaceExists(String namespace) {
        Document query = new Document("namespace", namespace);
        return namespaceCollection.find(query).first() != null;
    }
}
