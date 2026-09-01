package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.ControlStore;
import org.finos.calm.store.github.GitHubControlStore;
import org.finos.calm.store.mongo.MongoControlStore;
import org.finos.calm.store.nitrite.NitriteControlStore;

@ApplicationScoped
public class ControlStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoControlStore> mongoControlStore;

    @Inject
    Instance<NitriteControlStore> standaloneControlStore;

    @Inject
    Instance<GitHubControlStore> gitHubControlStore;

    @Produces
    @ApplicationScoped
    public ControlStore produceControlStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubControlStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneControlStore.get();
        } else {
            return mongoControlStore.get();
        }
    }
}
