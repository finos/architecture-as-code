package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.mongo.MongoArchitectureStore;
import org.finos.calm.store.nitrite.NitriteArchitectureStore;
import jakarta.enterprise.inject.Instance;

/**
 * Producer for ArchitectureStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class ArchitectureStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoArchitectureStore> mongoArchitectureStore;

    @Inject
    Instance<NitriteArchitectureStore> standaloneArchitectureStore;

    /**
     * Produces the appropriate ArchitectureStore implementation based on the configured database mode.
     *
     * @return the ArchitectureStore implementation
     */
    @Produces
    @ApplicationScoped
    public ArchitectureStore produceArchitectureStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneArchitectureStore.get();
        } else {
            return mongoArchitectureStore.get();
        }
    }
}