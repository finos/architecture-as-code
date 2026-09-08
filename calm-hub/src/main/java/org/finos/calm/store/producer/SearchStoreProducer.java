package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.SearchStore;
import org.finos.calm.store.github.GitHubSearchStore;
import org.finos.calm.store.mongo.MongoSearchStore;
import org.finos.calm.store.nitrite.NitriteSearchStore;

@ApplicationScoped
public class SearchStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoSearchStore> mongoSearchStore;

    @Inject
    Instance<NitriteSearchStore> standaloneSearchStore;

    @Inject
    Instance<GitHubSearchStore> gitHubSearchStore;

    @Produces
    @ApplicationScoped
    public SearchStore produceSearchStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubSearchStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneSearchStore.get();
        } else {
            return mongoSearchStore.get();
        }
    }
}
