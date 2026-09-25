package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.github.GitHubInterfaceStore;
import org.finos.calm.store.mongo.MongoInterfaceStore;
import org.finos.calm.store.nitrite.NitriteInterfaceStore;

/**
 * Producer for InterfaceStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class InterfaceStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoInterfaceStore> mongoInterfaceStore;

    @Inject
    Instance<NitriteInterfaceStore> standaloneInterfaceStore;

    @Inject
    Instance<GitHubInterfaceStore> gitHubInterfaceStore;

    /**
     * Produces the appropriate InterfaceStore implementation based on the configured database mode.
     *
     * @return the InterfaceStore implementation
     */
    @Produces
    @ApplicationScoped
    public InterfaceStore produceInterfaceStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return gitHubInterfaceStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneInterfaceStore.get();
        } else {
            return mongoInterfaceStore.get();
        }
    }
}
