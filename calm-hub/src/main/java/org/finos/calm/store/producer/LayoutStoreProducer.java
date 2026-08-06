package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.LayoutStore;
import org.finos.calm.store.mongo.MongoLayoutStore;
import org.finos.calm.store.nitrite.NitriteLayoutStore;

/**
 * Producer for LayoutStore implementations.
 * Selects the appropriate implementation based on the configured database mode.
 */
@ApplicationScoped
public class LayoutStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoLayoutStore> mongoLayoutStore;

    @Inject
    Instance<NitriteLayoutStore> nitriteLayoutStore;

    /**
     * Produces the appropriate LayoutStore implementation based on the configured database mode.
     *
     * @return the LayoutStore implementation
     */
    @Produces
    @ApplicationScoped
    public LayoutStore produceLayoutStore() {
        if ("standalone".equals(databaseMode)) {
            return nitriteLayoutStore.get();
        }
        return mongoLayoutStore.get();
    }
}
