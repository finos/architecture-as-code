package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.github.GitHubArchitectureStore;
import org.finos.calm.store.mongo.MongoArchitectureStore;
import org.finos.calm.store.nitrite.NitriteArchitectureStore;

@ApplicationScoped
public class ArchitectureStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoArchitectureStore> mongoArchitectureStore;

    @Inject
    Instance<NitriteArchitectureStore> standaloneArchitectureStore;

    @Inject
    Instance<GitHubArchitectureStore> gitHubArchitectureStore;

    @Produces
    @ApplicationScoped
    public ArchitectureStore produceArchitectureStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubArchitectureStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneArchitectureStore.get();
        } else {
            return mongoArchitectureStore.get();
        }
    }
}