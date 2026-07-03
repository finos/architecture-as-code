package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;

import static org.finos.calm.security.CalmHubPermissionChecker.GLOBAL_ACCESS;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import static org.dizitart.no2.filters.FluentFilter.where;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * Implementation of UserAccessStore using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteUserAccessStore.class)
public class NitriteUserAccessStore implements UserAccessStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteUserAccessStore.class);
    private static final String COLLECTION_NAME = "userAccess";
    private static final String USERNAME_FIELD = "username";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String DOMAIN_FIELD = "domain";
    private static final String PERMISSION_FIELD = "permission";
    private static final String USER_ACCESS_ID_FIELD = "userAccessId";
    private static final String CREATED_AT_FIELD = "createdAt";
    private static final String LAST_UPDATED_FIELD = "lastUpdated";

    private final Lock lock = new ReentrantLock();
    private final NitriteCollection userAccessCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final NitriteCounterStore counterStore;

    @Inject
    public NitriteUserAccessStore(@StandaloneQualifier Nitrite db, 
                                  NitriteNamespaceStore namespaceStore, 
                                  NitriteCounterStore counterStore) {
        this.userAccessCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        this.counterStore = counterStore;
        LOG.info("NitriteUserAccessStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public UserAccess createUserAccessForNamespace(UserAccess userAccess) throws NamespaceNotFoundException {
        LOG.info("User-access details: {}", userAccess);

        if (!GLOBAL_ACCESS.equals(userAccess.getNamespace()) && !namespaceStore.namespaceExists(userAccess.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        lock.lock();
        try {
            int userAccessId = counterStore.getNextUserAccessSequenceValue();

            Document userAccessDoc = Document.createDocument()
                    .put(USERNAME_FIELD, userAccess.getUsername())
                    .put(PERMISSION_FIELD, userAccess.getPermission().name())
                    .put(NAMESPACE_FIELD, userAccess.getNamespace())
                    .put(CREATED_AT_FIELD, userAccess.getCreationDateTime())
                    .put(LAST_UPDATED_FIELD, userAccess.getUpdateDateTime())
                    .put(USER_ACCESS_ID_FIELD, userAccessId);

            userAccessCollection.insert(userAccessDoc);

            LOG.info("UserAccess has been created for namespace: {}, permission: {}, username: {}",
                    userAccess.getNamespace(), userAccess.getPermission(), userAccess.getUsername());

            return new UserAccess.UserAccessBuilder()
                    .setUserAccessId(userAccessId)
                    .setNamespace(userAccess.getNamespace())
                    .setPermission(userAccess.getPermission())
                    .setUsername(userAccess.getUsername())
                    .build();
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<UserAccess> getUserAccessForUsername(String username) throws UserAccessNotFoundException {
        Filter filter = where(USERNAME_FIELD).eq(username);
        List<UserAccess> userAccessList = new ArrayList<>();
        
        for (Document doc : userAccessCollection.find(filter)) {
            UserAccess userAccess = buildUserAccessFromDocument(doc);
            userAccessList.add(userAccess);
        }

        if (userAccessList.isEmpty()) {
            throw new UserAccessNotFoundException();
        }
        return userAccessList;
    }

    @Override
    public List<UserAccess> getGrantsForUser(String username) {
        Filter filter = where(USERNAME_FIELD).in(username, "*");
        List<UserAccess> grants = new ArrayList<>();
        for (Document doc : userAccessCollection.find(filter)) {
            grants.add(buildUserAccessFromDocument(doc));
        }
        return grants;
    }

    @Override
    public List<UserAccess> getUserAccessForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!GLOBAL_ACCESS.equals(namespace) && !namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }
        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(filter)) {
            userAccessList.add(buildUserAccessFromDocument(doc));
        }
        return userAccessList;
    }

    @Override
    public UserAccess getUserAccessForNamespaceAndId(String namespace, Integer userAccessId) 
            throws NamespaceNotFoundException, UserAccessNotFoundException {
        
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace).and(where(USER_ACCESS_ID_FIELD).eq(userAccessId));
        Document document = userAccessCollection.find(filter).firstOrNull();

        if (document == null) {
            throw new UserAccessNotFoundException();
        }

        return buildUserAccessFromDocument(document);
    }

    @Override
    public UserAccess createUserAccessForDomain(UserAccess userAccess) {
        LOG.info("User-access details: {}", userAccess);

        lock.lock();
        try {
            int userAccessId = counterStore.getNextUserAccessSequenceValue();

            Document userAccessDoc = Document.createDocument()
                    .put(USERNAME_FIELD, userAccess.getUsername())
                    .put(PERMISSION_FIELD, userAccess.getPermission().name())
                    .put(DOMAIN_FIELD, userAccess.getDomain())
                    .put(CREATED_AT_FIELD, userAccess.getCreationDateTime())
                    .put(LAST_UPDATED_FIELD, userAccess.getUpdateDateTime())
                    .put(USER_ACCESS_ID_FIELD, userAccessId);

            userAccessCollection.insert(userAccessDoc);

            LOG.info("UserAccess has been created for domain: {}, permission: {}, username: {}",
                    userAccess.getDomain(), userAccess.getPermission(), userAccess.getUsername());

            return new UserAccess.UserAccessBuilder()
                    .setUserAccessId(userAccessId)
                    .setDomain(userAccess.getDomain())
                    .setPermission(userAccess.getPermission())
                    .setUsername(userAccess.getUsername())
                    .build();
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<UserAccess> getUserAccessForDomain(String domain) {
        Filter filter = where(DOMAIN_FIELD).eq(domain);
        List<UserAccess> userAccessList = new ArrayList<>();
        for (Document doc : userAccessCollection.find(filter)) {
            userAccessList.add(buildUserAccessFromDocument(doc));
        }
        return userAccessList;
    }

    @Override
    public UserAccess getUserAccessForDomainAndId(String domain, Integer userAccessId) throws UserAccessNotFoundException {
        Filter filter = where(DOMAIN_FIELD).eq(domain).and(where(USER_ACCESS_ID_FIELD).eq(userAccessId));
        Document document = userAccessCollection.find(filter).firstOrNull();

        if (document == null) {
            throw new UserAccessNotFoundException();
        }

        return buildUserAccessFromDocument(document);
    }

    @Override
    public void deleteUserAccessForDomain(String domain, Integer userAccessId) throws UserAccessNotFoundException {
        lock.lock();
        try {
            Filter filter = where(DOMAIN_FIELD).eq(domain).and(where(USER_ACCESS_ID_FIELD).eq(userAccessId));
            Document existing = userAccessCollection.find(filter).firstOrNull();
            if (existing == null) {
                throw new UserAccessNotFoundException();
            }
            userAccessCollection.remove(existing);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void deleteUserAccessForNamespace(String namespace, Integer userAccessId)
            throws NamespaceNotFoundException, UserAccessNotFoundException {

        if (!GLOBAL_ACCESS.equals(namespace) && !namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        lock.lock();
        try {
            Filter filter = where(NAMESPACE_FIELD).eq(namespace).and(where(USER_ACCESS_ID_FIELD).eq(userAccessId));
            Document existing = userAccessCollection.find(filter).firstOrNull();
            if (existing == null) {
                throw new UserAccessNotFoundException();
            }
            userAccessCollection.remove(existing);
        } finally {
            lock.unlock();
        }
    }

    private UserAccess buildUserAccessFromDocument(Document doc) {
        return new UserAccess.UserAccessBuilder()
                .setUsername(doc.get(USERNAME_FIELD, String.class))
                .setPermission(UserAccess.Permission.valueOf(doc.get(PERMISSION_FIELD, String.class)))
                .setNamespace(doc.get(NAMESPACE_FIELD, String.class))
                .setDomain(doc.get(DOMAIN_FIELD, String.class))
                .setUserAccessId(doc.get(USER_ACCESS_ID_FIELD, Integer.class))
                .build();
    }
}
