package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.NamespaceStore;

import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
@Typed(MongoNamespaceStore.class)
public class MongoNamespaceStore implements NamespaceStore {

    private final MongoCollection<Document> namespaceCollection;

    public MongoNamespaceStore(MongoDatabase database) {
        this.namespaceCollection = database.getCollection("namespaces");
    }

    @Override
    public List<NamespaceInfo> getNamespaces() {
        List<NamespaceInfo> namespaces = new ArrayList<>();
        for (Document doc : namespaceCollection.find()) {
            namespaces.add(new NamespaceInfo(doc.getString("name"), doc.getString("description")));
        }
        return namespaces;
    }

    @Override
    public boolean namespaceExists(String namespaceName) {
        Document query = new Document("name", namespaceName);
        return namespaceCollection.find(query).first() != null;
    }

    @Override
    public void createNamespace(String name, String description) {
        if (!namespaceExists(name)) {
            Document namespaceDoc = new Document("name", name)
                    .append("description", description);
            namespaceCollection.insertOne(namespaceDoc);
        }
    }
}
