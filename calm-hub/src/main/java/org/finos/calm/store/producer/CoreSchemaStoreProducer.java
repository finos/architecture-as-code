package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.CoreSchemaStore;
import org.finos.calm.store.mongo.MongoCoreSchemaStore;
import org.finos.calm.store.nitrite.NitriteCoreSchemaStore;

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
    MongoCoreSchemaStore mongoCoreSchemaStore;

    @Inject
    NitriteCoreSchemaStore standaloneCoreSchemaStore;

    /**
     * Produces the appropriate CoreSchemaStore implementation based on the configured database mode.
     *
     * @return the CoreSchemaStore implementation
     */
    @Produces
    @ApplicationScoped
    public CoreSchemaStore produceCoreSchemaStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneCoreSchemaStore;
        } else {
            return mongoCoreSchemaStore;
        }
    }
}