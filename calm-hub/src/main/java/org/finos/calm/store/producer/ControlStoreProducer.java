package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.ControlStore;
import org.finos.calm.store.mongo.MongoControlStore;
import org.finos.calm.store.nitrite.NitriteControlStore;

/**
 * Producer for ControlStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class ControlStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoControlStore mongoControlStore;

    @Inject
    NitriteControlStore standaloneControlStore;

    /**
     * Produces the appropriate ControlStore implementation based on the configured database mode.
     *
     * @return the ControlStore implementation
     */
    @Produces
    @ApplicationScoped
    public ControlStore produceControlStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneControlStore;
        } else {
            return mongoControlStore;
        }
    }
}