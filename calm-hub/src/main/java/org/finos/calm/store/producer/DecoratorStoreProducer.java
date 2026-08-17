package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.github.GitHubDecoratorStore;
import org.finos.calm.store.mongo.MongoDecoratorStore;
import org.finos.calm.store.nitrite.NitriteDecoratorStore;

@ApplicationScoped
public class DecoratorStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoDecoratorStore> mongoDecoratorStore;

    @Inject
    Instance<NitriteDecoratorStore> standaloneDecoratorStore;

    @Inject
    Instance<GitHubDecoratorStore> gitHubDecoratorStore;

    @Produces
    @ApplicationScoped
    public DecoratorStore produceDecoratorStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubDecoratorStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneDecoratorStore.get();
        } else {
            return mongoDecoratorStore.get();
        }
    }
}
