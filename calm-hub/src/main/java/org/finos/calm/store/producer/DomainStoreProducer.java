package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.mongo.MongoDomainStore;
import org.finos.calm.store.nitrite.NitriteDomainStore;

/**
 * Producer for DomainStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class DomainStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoDomainStore mongoDomainStore;

    @Inject
    NitriteDomainStore standaloneDomainStore;

    /**
     * Produces the appropriate DomainStore implementation based on the configured database mode.
     *
     * @return the DomainStore implementation
     */
    @Produces
    @ApplicationScoped
    public DomainStore produceDomainStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneDomainStore;
        } else {
            return mongoDomainStore;
        }
    }
}