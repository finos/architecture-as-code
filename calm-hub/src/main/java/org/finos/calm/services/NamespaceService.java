package org.finos.calm.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.UserAccessStore;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
public class NamespaceService {

    private static final Logger LOG = LoggerFactory.getLogger(NamespaceService.class);

    private final NamespaceStore namespaceStore;
    private final UserAccessStore userAccessStore;

    @Inject
    public NamespaceService(NamespaceStore namespaceStore, UserAccessStore userAccessStore) {
        this.namespaceStore = namespaceStore;
        this.userAccessStore = userAccessStore;
    }

    public List<NamespaceInfo> getNamespaces() {
        return namespaceStore.getNamespaces();
    }

    public void createNamespace(String name, String description) throws NamespaceAlreadyExistsException {
        namespaceStore.createNamespace(name, description);
        insertPublicReadGrant(name);
    }

    private void insertPublicReadGrant(String namespace) {
        try {
            userAccessStore.createUserAccessForNamespace(
                    new UserAccess("*", UserAccess.Permission.read, namespace));
            LOG.info("Inserted default * read grant for namespace [{}]", namespace);
        } catch (NamespaceNotFoundException e) {
            LOG.warn("Could not insert default * read grant for namespace [{}] — namespace not found immediately after creation", namespace);
        }
    }
}
