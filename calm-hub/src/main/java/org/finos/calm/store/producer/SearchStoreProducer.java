package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.SearchStore;
import org.finos.calm.store.mongo.MongoSearchStore;
import org.finos.calm.store.nitrite.NitriteSearchStore;

/**
 * Producer for SearchStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class SearchStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoSearchStore mongoSearchStore;

    @Inject
    NitriteSearchStore standaloneSearchStore;

    /**
     * Produces the appropriate SearchStore implementation based on the configured database mode.
     *
     * @return the SearchStore implementation
     */
    @Produces
    @ApplicationScoped
    public SearchStore produceSearchStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneSearchStore;
        } else {
            return mongoSearchStore;
        }
    }
}
