package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.mongo.MongoStandardStore;
import org.finos.calm.store.nitrite.NitriteStandardStore;

/**
 * Producer for PatternStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class StandardStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoStandardStore mongoStandardStore;

    @Inject
    NitriteStandardStore standaloneStandardStore;

    /**
     * Produces the appropriate PatternStore implementation based on the configured database mode.
     *
     * @return the PatternStore implementation
     */
    @Produces
    @ApplicationScoped
    public StandardStore produceStandardStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneStandardStore;
        } else {
            return mongoStandardStore;
        }
    }
}