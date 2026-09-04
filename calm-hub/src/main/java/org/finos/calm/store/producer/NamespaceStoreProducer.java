package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.github.GitHubNamespaceStore;
import org.finos.calm.store.mongo.MongoNamespaceStore;
import org.finos.calm.store.nitrite.NitriteNamespaceStore;

@ApplicationScoped
public class NamespaceStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoNamespaceStore> mongoNamespaceStore;

    @Inject
    Instance<NitriteNamespaceStore> standaloneNamespaceStore;

    @Inject
    Instance<GitHubNamespaceStore> gitHubNamespaceStore;

    @Produces
    @ApplicationScoped
    public NamespaceStore produceNamespaceStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubNamespaceStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneNamespaceStore.get();
        } else {
            return mongoNamespaceStore.get();
        }
    }
}