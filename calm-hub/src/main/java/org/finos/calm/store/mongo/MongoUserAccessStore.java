package org.finos.calm.store.mongo;

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
import io.quarkus.arc.lookup.LookupIfProperty;

@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoUserAccessStore.class)
public class MongoUserAccessStore implements UserAccessStore {

    private final MongoCollection<Document> userAccessCollection;
    private final MongoNamespaceStore namespaceStore;
    private final MongoCounterStore counterStore;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoUserAccessStore(MongoDatabase database, MongoNamespaceStore namespaceStore, MongoCounterStore counterStore) {
        this.namespaceStore = namespaceStore;
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
                .append("createdAt", userAccess.getCreationDateTime())
                .append("lastUpdated", userAccess.getUpdateDateTime())
                .append("userAccessId", userAccessId);

        userAccessCollection.insertOne(userAccessDoc);
        log.info("UserAccess has been created for namespace: {}, permission: {}, username: {}",
                userAccess.getNamespace(), userAccess.getPermission(), userAccess.getUsername());

        return new UserAccess.UserAccessBuilder()
                .setUserAccessId(userAccessId)
                .setNamespace(userAccess.getNamespace())
                .setPermission(userAccess.getPermission())
                .setUsername(userAccess.getUsername())
                .build();
    }

    @Override
    public UserAccess createUserAccessForDomain(UserAccess userAccess) {
        log.info("User-access details: {}", userAccess);
        int userAccessId = counterStore.getNextUserAccessSequenceValue();
        Document userAccessDoc = new Document("username", userAccess.getUsername())
                .append("permission", userAccess.getPermission().name())
                .append("domain", userAccess.getDomain())
                .append("createdAt", userAccess.getCreationDateTime())
                .append("lastUpdated", userAccess.getUpdateDateTime())
                .append("userAccessId", userAccessId);

        userAccessCollection.insertOne(userAccessDoc);
        log.info("UserAccess has been created for domain: {}, permission: {}, username: {}",
                userAccess.getDomain(), userAccess.getPermission(), userAccess.getUsername());

        return new UserAccess.UserAccessBuilder()
                .setUserAccessId(userAccessId)
                .setDomain(userAccess.getDomain())
                .setPermission(userAccess.getPermission())
                .setUsername(userAccess.getUsername())
                .build();
    }

    @Override
    public List<UserAccess> getUserAccessForUsername(String username)
            throws UserAccessNotFoundException {

        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.eq("username", username))) {
            userAccessList.add(buildFromDocument(doc));
        }

        if (userAccessList.isEmpty()) {
            throw new UserAccessNotFoundException();
        }
        return userAccessList;
    }

    @Override
    public List<UserAccess> getGrantsForUser(String username) {
        List<UserAccess> grants = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.in("username", username, "*"))) {
            grants.add(buildFromDocument(doc));
        }
        return grants;
    }

    @Override
    public List<UserAccess> getUserAccessForNamespace(String namespace)
            throws NamespaceNotFoundException, UserAccessNotFoundException {

        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }
        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.eq("namespace", namespace))) {
            userAccessList.add(buildFromDocument(doc));
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

        Document document = userAccessCollection.find(Filters.and(
                        Filters.eq("namespace", namespace),
                        Filters.eq("userAccessId", userAccessId)))
                .first();

        if (document == null) {
            throw new UserAccessNotFoundException();
        }
        return buildFromDocument(document);
    }

    @Override
    public List<UserAccess> getUserAccessForDomain(String domain)
            throws UserAccessNotFoundException {

        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.eq("domain", domain))) {
            userAccessList.add(buildFromDocument(doc));
        }

        if (userAccessList.isEmpty()) {
            throw new UserAccessNotFoundException();
        }
        return userAccessList;
    }

    @Override
    public UserAccess getUserAccessForDomainAndId(String domain, Integer userAccessId)
            throws UserAccessNotFoundException {

        Document document = userAccessCollection.find(Filters.and(
                        Filters.eq("domain", domain),
                        Filters.eq("userAccessId", userAccessId)))
                .first();

        if (document == null) {
            throw new UserAccessNotFoundException();
        }
        return buildFromDocument(document);
    }

    private UserAccess buildFromDocument(Document doc) {
        return new UserAccess.UserAccessBuilder()
                .setUsername(doc.getString("username"))
                .setPermission(UserAccess.Permission.valueOf(doc.getString("permission")))
                .setNamespace(doc.getString("namespace"))
                .setDomain(doc.getString("domain"))
                .setUserAccessId(doc.getInteger("userAccessId"))
                .build();
    }
}
