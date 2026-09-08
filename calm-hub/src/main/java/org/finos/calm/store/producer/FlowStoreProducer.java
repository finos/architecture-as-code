package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.github.GitHubFlowStore;
import org.finos.calm.store.mongo.MongoFlowStore;
import org.finos.calm.store.nitrite.NitriteFlowStore;

@ApplicationScoped
public class FlowStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoFlowStore> mongoFlowStore;

    @Inject
    Instance<NitriteFlowStore> standaloneFlowStore;

    @Inject
    Instance<GitHubFlowStore> gitHubFlowStore;

    @Produces
    @ApplicationScoped
    public FlowStore produceFlowStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubFlowStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneFlowStore.get();
        } else {
            return mongoFlowStore.get();
        }
    }
}
