package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.ConventionStore;
import org.finos.calm.store.github.GitHubConventionStore;
import org.finos.calm.store.mongo.MongoConventionStore;
import org.finos.calm.store.nitrite.NitriteConventionStore;

@ApplicationScoped
public class ConventionStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject Instance<MongoConventionStore> mongo;

    @Inject Instance<NitriteConventionStore> nitrite;

    @Inject Instance<GitHubConventionStore> github;

    @Produces
    @ApplicationScoped
    public ConventionStore produceConventionStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return github.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return nitrite.get();
        }
        return mongo.get();
    }
}
