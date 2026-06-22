package org.finos.calm.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@ApplicationScoped
public class DomainService {

    private static final Logger LOG = LoggerFactory.getLogger(DomainService.class);

    private final DomainStore domainStore;
    private final UserAccessStore userAccessStore;

    @Inject
    public DomainService(DomainStore domainStore, UserAccessStore userAccessStore) {
        this.domainStore = domainStore;
        this.userAccessStore = userAccessStore;
    }

    public List<String> getDomains() {
        return domainStore.getDomains();
    }

    public void createDomain(String name) throws DomainAlreadyExistsException {
        domainStore.createDomain(name);
        insertPublicReadGrant(name);
    }

    private void insertPublicReadGrant(String domain) {
        try {
            UserAccess grant = new UserAccess.UserAccessBuilder()
                    .setUsername("*")
                    .setPermission(UserAccess.Permission.read)
                    .setDomain(domain)
                    .build();
            userAccessStore.createUserAccessForDomain(grant);
            LOG.info("Inserted default * read grant for domain [{}]", domain);
        } catch (Exception e) {
            LOG.warn("Could not insert default * read grant for domain [{}]: {}", domain, e.getMessage());
        }
    }
}
