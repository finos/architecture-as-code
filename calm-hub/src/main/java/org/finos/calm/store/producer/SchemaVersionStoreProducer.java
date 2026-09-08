package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.SchemaVersionStore;
import org.finos.calm.store.mongo.MongoSchemaVersionStore;
import org.finos.calm.store.nitrite.NitriteSchemaVersionStore;
import org.finos.calm.store.noop.NoOpSchemaVersionStore;

@ApplicationScoped
public class SchemaVersionStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoSchemaVersionStore> mongoSchemaVersionStore;

    @Inject
    Instance<NitriteSchemaVersionStore> standaloneSchemaVersionStore;

    @Inject
    Instance<NoOpSchemaVersionStore> noOpSchemaVersionStore;

    @Produces
    @ApplicationScoped
    public SchemaVersionStore produceSchemaVersionStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return noOpSchemaVersionStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneSchemaVersionStore.get();
        } else {
            return mongoSchemaVersionStore.get();
        }
    }
}
