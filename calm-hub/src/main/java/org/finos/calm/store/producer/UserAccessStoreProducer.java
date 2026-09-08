package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.UserAccessStore;
import org.finos.calm.store.github.GitHubUserAccessStore;
import org.finos.calm.store.mongo.MongoUserAccessStore;
import org.finos.calm.store.nitrite.NitriteUserAccessStore;

@ApplicationScoped
public class UserAccessStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoUserAccessStore> mongoUserAccessStore;

    @Inject
    Instance<NitriteUserAccessStore> standaloneUserAccessStore;

    @Inject
    Instance<GitHubUserAccessStore> gitHubUserAccessStore;

    @Produces
    @ApplicationScoped
    public UserAccessStore produceUserAccessStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubUserAccessStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneUserAccessStore.get();
        } else {
            return mongoUserAccessStore.get();
        }
    }
}
