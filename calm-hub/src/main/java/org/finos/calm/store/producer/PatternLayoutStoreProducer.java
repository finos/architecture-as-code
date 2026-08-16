package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.PatternLayoutStore;
import org.finos.calm.store.mongo.MongoPatternLayoutStore;
import org.finos.calm.store.nitrite.NitritePatternLayoutStore;

/**
 * Producer for PatternLayoutStore implementations.
 * Selects the appropriate implementation based on the configured database mode.
 */
@ApplicationScoped
public class PatternLayoutStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoPatternLayoutStore> mongoPatternLayoutStore;

    @Inject
    Instance<NitritePatternLayoutStore> nitritePatternLayoutStore;

    /**
     * Produces the appropriate PatternLayoutStore implementation based on the configured database mode.
     *
     * @return the PatternLayoutStore implementation
     */
    @Produces
    @ApplicationScoped
    public PatternLayoutStore producePatternLayoutStore() {
        if ("standalone".equals(databaseMode)) {
            return nitritePatternLayoutStore.get();
        }
        return mongoPatternLayoutStore.get();
    }
}
