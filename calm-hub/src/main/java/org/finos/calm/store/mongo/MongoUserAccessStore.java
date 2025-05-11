package org.finos.calm.store.mongo;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class MongoUserAccessStore implements UserAccessStore {

    private final MongoCollection<Document> userAccessCollection;
    private final MongoNamespaceStore namespaceStore;
    private final MongoCounterStore counterStore;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoUserAccessStore(MongoClient mongoClient, MongoNamespaceStore namespaceStore, MongoCounterStore counterStore) {
        this.namespaceStore = namespaceStore;
        MongoDatabase database = mongoClient.getDatabase("calmSchemas");
        this.userAccessCollection = database.getCollection("userAccess");
        this.counterStore = counterStore;
    }

    @Override
    public UserAccess createUserAccessForNamespace(UserAccess userAccess)
            throws NamespaceNotFoundException, JsonParseException {

        log.info("User-access details: {}",userAccess);
        if (!namespaceStore.namespaceExists(userAccess.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextUserAccessSequenceValue();
        Document userAccessDoc = new Document("username", userAccess.getUsername())
                .append("role", userAccess.getRole())
                .append("namespace", userAccess.getNamespace())
                .append("resource", userAccess.getResource())
                .append("createdAt", userAccess.getCreationDateTime())
                .append("lastUpdated", userAccess.getUpdateDateTime())
                .append("id", id);

        userAccessCollection.insertOne(userAccessDoc);
        log.info("UserAccess has been created for namespace: {}, resource: {}, role: {}, username: {}",
                userAccess.getNamespace(), userAccess.getResource(), userAccess.getRole(), userAccess.getUsername());

        UserAccess persistedUserAccess = new UserAccess.UserAccessBuilder()
                .setId(id)
                .setResource(userAccess.getResource())
                .setNamespace(userAccess.getNamespace())
                .setRole(userAccess.getRole())
                .setUsername(userAccess.getUsername())
                .build();
        return persistedUserAccess;
    }

    @Override
    public List<UserAccess> getUserAccessForUsername(String username)
            throws NamespaceNotFoundException, JsonParseException, UserAccessNotFoundException {

        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.eq("username", username))) {
            String namespace = doc.getString("namespace");
            if (!namespaceStore.namespaceExists(namespace)) {
                throw new NamespaceNotFoundException();
            }

            UserAccess userAccess = new UserAccess.UserAccessBuilder()
                    .setUsername(doc.getString("username"))
                    .setRole(doc.getString("role"))
                    .setNamespace(namespace)
                    .setResource(doc.getString("resource"))
                    .setId(doc.getInteger("id"))
                    .build();

            userAccessList.add(userAccess);
        }

        if (userAccessList.isEmpty()) {
            throw new UserAccessNotFoundException();
        }
        return userAccessList;
    }

    @Override
    public List<UserAccess> getUserAccessForNamespace(String namespace)
            throws NamespaceNotFoundException, JsonParseException, UserAccessNotFoundException {

        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }
        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.eq("namespace", namespace))) {
            UserAccess userAccess = new UserAccess.UserAccessBuilder()
                    .setUsername(doc.getString("username"))
                    .setRole(doc.getString("role"))
                    .setNamespace(namespace)
                    .setResource(doc.getString("resource"))
                    .setId(doc.getInteger("id"))
                    .build();
            userAccessList.add(userAccess);
        }

        if (userAccessList.isEmpty()) {
            throw new UserAccessNotFoundException();
        }
        return userAccessList;
    }
}
