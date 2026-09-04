package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.LayoutStore;
import org.finos.calm.store.github.GitHubLayoutStore;
import org.finos.calm.store.mongo.MongoLayoutStore;
import org.finos.calm.store.nitrite.NitriteLayoutStore;

@ApplicationScoped
public class LayoutStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoLayoutStore> mongoLayoutStore;

    @Inject
    Instance<NitriteLayoutStore> standaloneLayoutStore;

    @Inject
    Instance<GitHubLayoutStore> gitHubLayoutStore;

    @Produces
    @ApplicationScoped
    public LayoutStore produceLayoutStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubLayoutStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneLayoutStore.get();
        } else {
            return mongoLayoutStore.get();
        }
    }
}
