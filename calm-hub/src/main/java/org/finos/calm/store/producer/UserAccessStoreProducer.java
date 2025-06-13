package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.UserAccessStore;
import org.finos.calm.store.mongo.MongoUserAccessStore;
import org.finos.calm.store.nitrite.NitriteUserAccessStore;

/**
 * Producer for UserAccessStore implementations.
 * Selects the appropriate implementation based on the configured database mode.
 */
@ApplicationScoped
public class UserAccessStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoUserAccessStore mongoUserAccessStore;

    @Inject
    NitriteUserAccessStore standaloneUserAccessStore;

    /**
     * Produces the appropriate UserAccessStore implementation based on the configured database mode.
     *
     * @return the UserAccessStore implementation
     */
    @Produces
    @ApplicationScoped
    public UserAccessStore produceUserAccessStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneUserAccessStore;
        } else {
            return mongoUserAccessStore;
        }
    }
}
