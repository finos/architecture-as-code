package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.github.GitHubDomainStore;
import org.finos.calm.store.mongo.MongoDomainStore;
import org.finos.calm.store.nitrite.NitriteDomainStore;

@ApplicationScoped
public class DomainStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoDomainStore> mongoDomainStore;

    @Inject
    Instance<NitriteDomainStore> standaloneDomainStore;

    @Inject
    Instance<GitHubDomainStore> gitHubDomainStore;

    @Produces
    @ApplicationScoped
    public DomainStore produceDomainStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubDomainStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneDomainStore.get();
        } else {
            return mongoDomainStore.get();
        }
    }
}