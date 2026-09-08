package org.finos.calm.store.producer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.CoreSchemaStore;
import org.finos.calm.store.classpath.ClasspathCoreSchemaStore;
import org.finos.calm.store.mongo.MongoCoreSchemaStore;
import org.finos.calm.store.nitrite.NitriteCoreSchemaStore;

@ApplicationScoped
public class CoreSchemaStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    Instance<MongoCoreSchemaStore> mongoCoreSchemaStore;

    @Inject
    Instance<NitriteCoreSchemaStore> standaloneCoreSchemaStore;

    @Inject
    Instance<ClasspathCoreSchemaStore> classpathCoreSchemaStore;

    @Produces
    @ApplicationScoped
    public CoreSchemaStore produceCoreSchemaStore() {
        if (DatabaseMode.GITHUB.equals(databaseMode)) {
            return classpathCoreSchemaStore.get();
        } else if (DatabaseMode.STANDALONE.equals(databaseMode)) {
            return standaloneCoreSchemaStore.get();
        } else {
            return mongoCoreSchemaStore.get();
        }
    }
}