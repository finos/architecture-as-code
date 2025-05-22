package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.mongo.MongoNamespaceStore;
import org.finos.calm.store.nitrite.NitriteNamespaceStore;

/**
 * Producer for NamespaceStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class NamespaceStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoNamespaceStore mongoNamespaceStore;

    @Inject
    NitriteNamespaceStore standaloneNamespaceStore;

    /**
     * Produces the appropriate NamespaceStore implementation based on the configured database mode.
     *
     * @return the NamespaceStore implementation
     */
    @Produces
    @ApplicationScoped
    public NamespaceStore produceNamespaceStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneNamespaceStore;
        } else {
            return mongoNamespaceStore;
        }
    }
}