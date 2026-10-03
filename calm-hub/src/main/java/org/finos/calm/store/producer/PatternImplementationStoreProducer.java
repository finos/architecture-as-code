package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.PatternImplementationStore;
import org.finos.calm.store.mongo.MongoPatternImplementationStore;
import org.finos.calm.store.nitrite.NitritePatternImplementationStore;

/**
 * Producer for PatternImplementationStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class PatternImplementationStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoPatternImplementationStore> mongoStore;

    @Inject
    Instance<NitritePatternImplementationStore> standaloneStore;

    @Produces
    @ApplicationScoped
    public PatternImplementationStore producePatternImplementationStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneStore.get();
        } else {
            return mongoStore.get();
        }
    }
}
