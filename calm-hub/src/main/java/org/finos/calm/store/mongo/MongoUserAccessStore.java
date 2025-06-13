package org.finos.calm.store.mongo;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
@Typed(MongoUserAccessStore.class)
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
            throws NamespaceNotFoundException {

        log.info("User-access details: {}", userAccess);
        if (!namespaceStore.namespaceExists(userAccess.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        int userAccessId = counterStore.getNextUserAccessSequenceValue();
        Document userAccessDoc = new Document("username", userAccess.getUsername())
                .append("permission", userAccess.getPermission().name())
                .append("namespace", userAccess.getNamespace())
                .append("resourceType", userAccess.getResourceType().name())
                .append("createdAt", userAccess.getCreationDateTime())
                .append("lastUpdated", userAccess.getUpdateDateTime())
                .append("userAccessId", userAccessId);

        userAccessCollection.insertOne(userAccessDoc);
        log.info("UserAccess has been created for namespace: {}, resource: {}, permission: {}, username: {}",
                userAccess.getNamespace(), userAccess.getResourceType(), userAccess.getPermission(), userAccess.getUsername());

        UserAccess persistedUserAccess = new UserAccess.UserAccessBuilder()
                .setUserAccessId(userAccessId)
                .setResourceType(userAccess.getResourceType())
                .setNamespace(userAccess.getNamespace())
                .setPermission(userAccess.getPermission())
                .setUsername(userAccess.getUsername())
                .build();
        return persistedUserAccess;
    }

    @Override
    public List<UserAccess> getUserAccessForUsername(String username)
            throws UserAccessNotFoundException {

        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.eq("username", username))) {
            String namespace = doc.getString("namespace");

            UserAccess userAccess = new UserAccess.UserAccessBuilder()
                    .setUsername(doc.getString("username"))
                    .setPermission(UserAccess.Permission.valueOf(doc.getString("permission")))
                    .setNamespace(namespace)
                    .setResourceType(UserAccess.ResourceType.valueOf(doc.getString("resourceType")))
                    .setUserAccessId(doc.getInteger("userAccessId"))
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
            throws NamespaceNotFoundException, UserAccessNotFoundException {

        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }
        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.eq("namespace", namespace))) {
            UserAccess userAccess = new UserAccess.UserAccessBuilder()
                    .setUsername(doc.getString("username"))
                    .setPermission(UserAccess.Permission.valueOf(doc.getString("permission")))
                    .setNamespace(namespace)
                    .setResourceType(UserAccess.ResourceType.valueOf(doc.getString("resourceType")))
                    .setUserAccessId(doc.getInteger("userAccessId"))
                    .build();
            userAccessList.add(userAccess);
        }

        if (userAccessList.isEmpty()) {
            throw new UserAccessNotFoundException();
        }
        return userAccessList;
    }

    @Override
    public UserAccess getUserAccessForNamespaceAndId(String namespace, Integer userAccessId)
            throws NamespaceNotFoundException, UserAccessNotFoundException {

        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document document = userAccessCollection.find(Filters.and(Filters.eq("namespace", namespace),
                        Filters.eq("userAccessId", userAccessId)))
                .first();

        if (null == document) {
            throw new UserAccessNotFoundException();
        } else {
            return new UserAccess.UserAccessBuilder()
                    .setUsername(document.getString("username"))
                    .setPermission(UserAccess.Permission.valueOf(document.getString("permission")))
                    .setNamespace(namespace)
                    .setResourceType(UserAccess.ResourceType.valueOf(document.getString("resourceType")))
                    .setUserAccessId(document.getInteger("userAccessId"))
                    .build();
        }
    }
}
