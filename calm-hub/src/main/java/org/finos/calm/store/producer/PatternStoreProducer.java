package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.github.GitHubPatternStore;
import org.finos.calm.store.mongo.MongoPatternStore;
import org.finos.calm.store.nitrite.NitritePatternStore;

/**
 * Producer for PatternStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class PatternStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoPatternStore> mongoPatternStore;

    @Inject
    Instance<NitritePatternStore> standalonePatternStore;

    @Inject
    Instance<GitHubPatternStore> gitHubPatternStore;

    /**
     * Produces the appropriate PatternStore implementation based on the configured database mode.
     *
     * @return the PatternStore implementation
     */
    @Produces
    @ApplicationScoped
    public PatternStore producePatternStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubPatternStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standalonePatternStore.get();
        } else {
            return mongoPatternStore.get();
        }
    }
}