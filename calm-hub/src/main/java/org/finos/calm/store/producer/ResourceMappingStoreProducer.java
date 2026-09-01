package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.github.GitHubResourceMappingStore;
import org.finos.calm.store.mongo.MongoResourceMappingStore;
import org.finos.calm.store.nitrite.NitriteResourceMappingStore;

@ApplicationScoped
public class ResourceMappingStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoResourceMappingStore> mongoResourceMappingStore;

    @Inject
    Instance<NitriteResourceMappingStore> standaloneResourceMappingStore;

    @Inject
    Instance<GitHubResourceMappingStore> gitHubResourceMappingStore;

    @Produces
    @ApplicationScoped
    public ResourceMappingStore produceResourceMappingStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubResourceMappingStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneResourceMappingStore.get();
        } else {
            return mongoResourceMappingStore.get();
        }
    }
}
