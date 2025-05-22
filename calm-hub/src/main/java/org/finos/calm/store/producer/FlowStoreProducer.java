package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.mongo.MongoFlowStore;
import org.finos.calm.store.nitrite.NitriteFlowStore;

/**
 * Producer for FlowStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class FlowStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoFlowStore mongoFlowStore;

    @Inject
    NitriteFlowStore standaloneFlowStore;

    /**
     * Produces the appropriate FlowStore implementation based on the configured database mode.
     *
     * @return the FlowStore implementation
     */
    @Produces
    @ApplicationScoped
    public FlowStore produceFlowStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneFlowStore;
        } else {
            return mongoFlowStore;
        }
    }
}