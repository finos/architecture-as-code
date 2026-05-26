package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.CoreSchemaStore;
import org.finos.calm.store.mongo.MongoCoreSchemaStore;
import org.finos.calm.store.nitrite.NitriteCoreSchemaStore;
import jakarta.enterprise.inject.Instance;

/**
 * Producer for CoreSchemaStore implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class CoreSchemaStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoCoreSchemaStore> mongoCoreSchemaStore;

    @Inject
    Instance<NitriteCoreSchemaStore> standaloneCoreSchemaStore;

    /**
     * Produces the appropriate CoreSchemaStore implementation based on the configured database mode.
     *
     * @return the CoreSchemaStore implementation
     */
    @Produces
    @ApplicationScoped
    public CoreSchemaStore produceCoreSchemaStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneCoreSchemaStore.get();
        } else {
            return mongoCoreSchemaStore.get();
        }
    }
}