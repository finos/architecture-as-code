package org.finos.calm.store.mongo;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.result.DeleteResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;

import static org.finos.calm.security.CalmHubPermissionChecker.GLOBAL_ACCESS;
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
        if (!GLOBAL_ACCESS.equals(userAccess.getNamespace())) {
            namespaceStore.requireNamespace(userAccess.getNamespace());
        }

        return createUserAccess(userAccess, "namespace", userAccess.getNamespace());
    }

    @Override
    public UserAccess createUserAccessForDomain(UserAccess userAccess) {
        log.info("User-access details: {}", userAccess);
        return createUserAccess(userAccess, "domain", userAccess.getDomain());
    }

    /**
     * Creates a grant scoped by either {@code namespace} or {@code domain} (whichever
     * {@code scopeField} names). On a concurrent duplicate-key race, returns the winner's
     * grant instead of throwing — the grant is additive/idempotent, so this keeps create
     * idempotent under multi-instance concurrency.
     */
    private UserAccess createUserAccess(UserAccess userAccess, String scopeField, String scopeValue) {
        int userAccessId = counterStore.getNextUserAccessSequenceValue();
        Document userAccessDoc = new Document("username", userAccess.getUsername())
                .append("permission", userAccess.getPermission().name())
                .append(scopeField, scopeValue)
                .append("createdAt", userAccess.getCreationDateTime())
                .append("lastUpdated", userAccess.getUpdateDateTime())
                .append("userAccessId", userAccessId);

        try {
            userAccessCollection.insertOne(userAccessDoc);
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() != ErrorCategory.DUPLICATE_KEY) {
                throw e;
            }
            log.info("Grant already exists for {}: {}, permission: {}, username: {}",
                    scopeField, scopeValue, userAccess.getPermission(), userAccess.getUsername());
            Document existingGrant = findExistingGrant(Filters.eq(scopeField, scopeValue), userAccess);
            if (existingGrant == null) {
                // The racing writer's document is gone by the time we looked it up (e.g. revoked
                // concurrently) — nothing to return, so surface the original write failure.
                throw e;
            }
            return buildFromDocument(existingGrant);
        }
        log.info("UserAccess has been created for {}: {}, permission: {}, username: {}",
                scopeField, scopeValue, userAccess.getPermission(), userAccess.getUsername());

        return buildFromDocument(userAccessDoc);
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
    public List<UserAccess> getUserAccessForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!GLOBAL_ACCESS.equals(namespace)) {
            namespaceStore.requireNamespace(namespace);
        }
        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.eq("namespace", namespace))) {
            userAccessList.add(buildFromDocument(doc));
        }
        return userAccessList;
    }

    @Override
    public UserAccess getUserAccessForNamespaceAndId(String namespace, Integer userAccessId)
            throws NamespaceNotFoundException, UserAccessNotFoundException {

        if (!GLOBAL_ACCESS.equals(namespace)) {
            namespaceStore.requireNamespace(namespace);
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
    public List<UserAccess> getUserAccessForDomain(String domain) {
        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(Filters.eq("domain", domain))) {
            userAccessList.add(buildFromDocument(doc));
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

    @Override
    public void deleteUserAccessForDomain(String domain, Integer userAccessId) throws UserAccessNotFoundException {
        DeleteResult result = userAccessCollection.deleteOne(Filters.and(
                Filters.eq("domain", domain),
                Filters.eq("userAccessId", userAccessId)));
        if (result.getDeletedCount() == 0) {
            throw new UserAccessNotFoundException();
        }
    }

    @Override
    public void deleteUserAccessForNamespace(String namespace, Integer userAccessId)
            throws NamespaceNotFoundException, UserAccessNotFoundException {

        if (!GLOBAL_ACCESS.equals(namespace)) {
            namespaceStore.requireNamespace(namespace);
        }

        DeleteResult result = userAccessCollection.deleteOne(Filters.and(
                Filters.eq("namespace", namespace),
                Filters.eq("userAccessId", userAccessId)));

        if (result.getDeletedCount() == 0) {
            throw new UserAccessNotFoundException();
        }
    }

    @Override
    public void deleteAllUserAccessForNamespace(String namespace) {
        userAccessCollection.deleteMany(Filters.eq("namespace", namespace));
    }

    @Override
    public void deleteAllUserAccessForDomain(String domain) {
        userAccessCollection.deleteMany(Filters.eq("domain", domain));
    }

    private Document findExistingGrant(Bson scopeFilter, UserAccess userAccess) {
        return userAccessCollection.find(Filters.and(
                Filters.eq("username", userAccess.getUsername()),
                scopeFilter,
                Filters.eq("permission", userAccess.getPermission().name())
        )).first();
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
