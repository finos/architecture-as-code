package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.mongo.MongoDecoratorStore;
import org.finos.calm.store.nitrite.NitriteDecoratorStore;

/**
 * Producer for DecoratorStore implementations.
 * Selects the appropriate implementation based on the configured database mode.
 */
@ApplicationScoped
public class DecoratorStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoDecoratorStore mongoDecoratorStore;

    @Inject
    NitriteDecoratorStore nitriteDecoratorStore;

    /**
     * Produces the appropriate DecoratorStore implementation based on the configured database mode.
     *
     * @return the DecoratorStore implementation
     */
    @Produces
    @ApplicationScoped
    public DecoratorStore produceDecoratorStore() {
        if ("standalone".equals(databaseMode)) {
            return nitriteDecoratorStore;
        }
        return mongoDecoratorStore;
    }
}
