package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.PatternImplementationStore;
import org.finos.calm.store.mongo.MongoPatternImplementationStore;
import org.finos.calm.store.nitrite.NitritePatternImplementationStore;
import org.finos.calm.store.noop.NoOpPatternImplementationStore;

/**
 * Producer for PatternImplementationStore implementations.
 * This class provides the MongoDB, NitriteDB or GitHub-mode implementation based on configuration.
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

    @Inject
    Instance<NoOpPatternImplementationStore> gitHubStore;

    @Produces
    @ApplicationScoped
    public PatternImplementationStore producePatternImplementationStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneStore.get();
        } else {
            return mongoStore.get();
        }
    }
}
