package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.TimelineStore;
import org.finos.calm.store.mongo.MongoTimelineStore;
import org.finos.calm.store.nitrite.NitriteTimelineStore;

/**
 * Producer for TimelineStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class TimelineStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoTimelineStore mongoTimelineStore;

    @Inject
    NitriteTimelineStore standaloneTimelineStore;

    /**
     * Produces the appropriate TimelineStore implementation based on the configured database mode.
     *
     * @return the TimelineStore implementation
     */
    @Produces
    @ApplicationScoped
    public TimelineStore produceTimelineStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneTimelineStore;
        } else {
            return mongoTimelineStore;
        }
    }
}
