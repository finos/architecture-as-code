package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.mongo.MongoResourceMappingStore;
import org.finos.calm.store.nitrite.NitriteResourceMappingStore;
import jakarta.enterprise.inject.Instance;

/**
 * Producer for ResourceMappingStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class ResourceMappingStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoResourceMappingStore> mongoResourceMappingStore;

    @Inject
    Instance<NitriteResourceMappingStore> standaloneResourceMappingStore;

    @Produces
    @ApplicationScoped
    public ResourceMappingStore produceResourceMappingStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneResourceMappingStore.get();
        } else {
            return mongoResourceMappingStore.get();
        }
    }
}
