package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.github.GitHubAdrStore;
import org.finos.calm.store.mongo.MongoAdrStore;
import org.finos.calm.store.nitrite.NitriteAdrStore;

@ApplicationScoped
public class AdrStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoAdrStore> mongoAdrStore;

    @Inject
    Instance<NitriteAdrStore> standaloneAdrStore;

    @Inject
    Instance<GitHubAdrStore> gitHubAdrStore;

    @Produces
    @ApplicationScoped
    public AdrStore produceAdrStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubAdrStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneAdrStore.get();
        } else {
            return mongoAdrStore.get();
        }
    }
}
