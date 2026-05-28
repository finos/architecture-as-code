package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.mongo.MongoInterfaceStore;
import org.finos.calm.store.nitrite.NitriteInterfaceStore;
import jakarta.enterprise.inject.Instance;

/**
 * Producer for InterfaceStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class InterfaceStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoInterfaceStore> mongoInterfaceStore;

    @Inject
    Instance<NitriteInterfaceStore> standaloneInterfaceStore;

    /**
     * Produces the appropriate InterfaceStore implementation based on the configured database mode.
     *
     * @return the InterfaceStore implementation
     */
    @Produces
    @ApplicationScoped
    public InterfaceStore produceInterfaceStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneInterfaceStore.get();
        } else {
            return mongoInterfaceStore.get();
        }
    }
}
