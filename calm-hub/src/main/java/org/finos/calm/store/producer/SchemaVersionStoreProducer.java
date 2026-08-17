package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.store.SchemaVersionStore;
import org.finos.calm.store.mongo.MongoSchemaVersionStore;
import org.finos.calm.store.nitrite.NitriteSchemaVersionStore;

/**
 * Producer for {@link SchemaVersionStore} implementations.
 * This class provides either the MongoDB or NitriteDB implementation based on configuration.
 */
@ApplicationScoped
public class SchemaVersionStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoSchemaVersionStore> mongoSchemaVersionStore;

    @Inject
    Instance<NitriteSchemaVersionStore> standaloneSchemaVersionStore;

    /**
     * Produces the appropriate SchemaVersionStore implementation based on the configured database mode.
     *
     * @return the SchemaVersionStore implementation
     */
    @Produces
    @ApplicationScoped
    public SchemaVersionStore produceSchemaVersionStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneSchemaVersionStore.get();
        } else {
            return mongoSchemaVersionStore.get();
        }
    }
}
