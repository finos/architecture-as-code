package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.mongo.MongoResourceMappingStore;
import org.finos.calm.store.nitrite.NitriteResourceMappingStore;

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
    MongoResourceMappingStore mongoResourceMappingStore;

    @Inject
    NitriteResourceMappingStore standaloneResourceMappingStore;

    @Produces
    @ApplicationScoped
    public ResourceMappingStore produceResourceMappingStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneResourceMappingStore;
        } else {
            return mongoResourceMappingStore;
        }
    }
}
