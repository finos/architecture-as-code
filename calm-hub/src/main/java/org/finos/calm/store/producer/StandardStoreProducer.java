package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.github.GitHubStandardStore;
import org.finos.calm.store.mongo.MongoStandardStore;
import org.finos.calm.store.nitrite.NitriteStandardStore;

@ApplicationScoped
public class StandardStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoStandardStore> mongoStandardStore;

    @Inject
    Instance<NitriteStandardStore> standaloneStandardStore;

    @Inject
    Instance<GitHubStandardStore> gitHubStandardStore;

    @Produces
    @ApplicationScoped
    public StandardStore produceStandardStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubStandardStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneStandardStore.get();
        } else {
            return mongoStandardStore.get();
        }
    }
}
