package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.mongo.MongoAdrStore;
import org.finos.calm.store.nitrite.NitriteAdrStore;
import jakarta.enterprise.inject.Instance;

/**
 * Producer for AdrStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class AdrStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoAdrStore> mongoAdrStore;

    @Inject
    Instance<NitriteAdrStore> standaloneAdrStore;

    /**
     * Produces the appropriate AdrStore implementation based on the configured database mode.
     *
     * @return the AdrStore implementation
     */
    @Produces
    @ApplicationScoped
    public AdrStore produceAdrStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneAdrStore.get();
        } else {
            return mongoAdrStore.get();
        }
    }
}