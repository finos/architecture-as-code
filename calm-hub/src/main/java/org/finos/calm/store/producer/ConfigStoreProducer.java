package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.ConfigStore;
import org.finos.calm.store.github.GitHubConfigStore;
import org.finos.calm.store.mongo.MongoConfigStore;
import org.finos.calm.store.nitrite.NitriteConfigStore;

@ApplicationScoped
public class ConfigStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject Instance<MongoConfigStore> mongo;

    @Inject Instance<NitriteConfigStore> nitrite;

    @Inject Instance<GitHubConfigStore> github;

    @Produces
    @ApplicationScoped
    public ConfigStore produceConfigStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return github.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return nitrite.get();
        }
        return mongo.get();
    }
}
