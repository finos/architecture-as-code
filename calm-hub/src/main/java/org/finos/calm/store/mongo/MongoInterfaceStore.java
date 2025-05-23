package org.finos.calm.store.mongo;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.finos.calm.domain.Interface;
import org.finos.calm.domain.InterfaceMeta;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.InterfaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class MongoInterfaceStore implements InterfaceStore {

    private final MongoCollection<Document> interfaceCollection;
    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoInterfaceStore(MongoClient mongoClient, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.interfaceCollection = database.getCollection("interfaces");
    }

    @Override
    public Interface createInterfaceForNamespace(Interface interfaceToPersist) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(interfaceToPersist.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextInterfaceSequenceValue();
        Document interfaceDocument = new Document(
                Map.of("interfaceId", id,
                        "name", interfaceToPersist.getName(),
                        "description", interfaceToPersist.getDescription()))
                .append("versions",
                new Document("1-0-0", Document.parse(interfaceToPersist.getInterfaceJson())));

        interfaceCollection.updateOne(
                Filters.eq("namespace", interfaceToPersist.getNamespace()),
                Updates.push("interfaces", interfaceDocument),
                new UpdateOptions().upsert(true));

        return new Interface.InterfaceBuilder()
                .setInterfaceJson(interfaceToPersist.getInterfaceJson())
                .setId(id)
                .setName(interfaceToPersist.getName())
                .setDescription(interfaceToPersist.getDescription())
                .setVersion("1.0.0")
                .setNamespace(interfaceToPersist.getNamespace())
                .build();
    }

    @Override
    public List<InterfaceMeta> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException {
        if(!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = interfaceCollection.find(Filters.eq("namespace", namespace)).first();
        //protects from an unpopulated mongo collection
        if(namespaceDocument == null || namespaceDocument.isEmpty()) {
            return List.of();
        }

        List<Document> interfaces = namespaceDocument.getList("interfaces", Document.class);
        List<InterfaceMeta> interfaceMetas = new ArrayList<>();

        for (Document interfaceDoc : interfaces) {
            InterfaceMeta interfaceMeta = new InterfaceMeta(
                    interfaceDoc.getInteger("interfaceId"),
                    interfaceDoc.getString("name"),
                    interfaceDoc.getString("description")
            );
            interfaceMetas.add(interfaceMeta);
        }

        return interfaceMetas;
    }
}
