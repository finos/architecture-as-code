package org.finos.calm.store.producer;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.CoreSchemaStore;
import org.finos.calm.store.classpath.ClasspathCoreSchemaStore;
import org.finos.calm.store.mongo.MongoCoreSchemaStore;
import org.finos.calm.store.nitrite.NitriteCoreSchemaStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;
import jakarta.enterprise.inject.Instance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.when;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
public class TestCoreSchemaStoreProducerShould {

    @Mock
    MongoCoreSchemaStore mongoCoreSchemaStore;

    @Mock
    Instance<MongoCoreSchemaStore> mongoCoreSchemaStoreInstance;

    @Mock
    NitriteCoreSchemaStore nitriteCoreSchemaStore;

    @Mock
    Instance<NitriteCoreSchemaStore> nitriteCoreSchemaStoreInstance;

    @Mock
    ClasspathCoreSchemaStore classpathCoreSchemaStore;

    @Mock
    Instance<ClasspathCoreSchemaStore> classpathCoreSchemaStoreInstance;

    private CoreSchemaStoreProducer coreSchemaStoreProducer;

    @BeforeEach
    void setup() {
        coreSchemaStoreProducer = new CoreSchemaStoreProducer();
        when(mongoCoreSchemaStoreInstance.get()).thenReturn(mongoCoreSchemaStore);
        coreSchemaStoreProducer.mongoCoreSchemaStore = mongoCoreSchemaStoreInstance;
        when(nitriteCoreSchemaStoreInstance.get()).thenReturn(nitriteCoreSchemaStore);
        coreSchemaStoreProducer.standaloneCoreSchemaStore = nitriteCoreSchemaStoreInstance;
        when(classpathCoreSchemaStoreInstance.get()).thenReturn(classpathCoreSchemaStore);
        coreSchemaStoreProducer.classpathCoreSchemaStore = classpathCoreSchemaStoreInstance;
    }

    @Test
    void return_mongo_core_schema_store_when_database_mode_is_mongo() {
        coreSchemaStoreProducer.databaseMode = DatabaseMode.MONGO;

        CoreSchemaStore result = coreSchemaStoreProducer.produceCoreSchemaStore();

        assertThat(result, is(sameInstance(mongoCoreSchemaStore)));
    }

    @Test
    void return_nitrite_core_schema_store_when_database_mode_is_standalone() {
        coreSchemaStoreProducer.databaseMode = DatabaseMode.STANDALONE;

        CoreSchemaStore result = coreSchemaStoreProducer.produceCoreSchemaStore();

        assertThat(result, is(sameInstance(nitriteCoreSchemaStore)));
    }

    @Test
    void return_mongo_core_schema_store_when_database_mode_is_not_recognized() {
        coreSchemaStoreProducer.databaseMode = "unknown";

        CoreSchemaStore result = coreSchemaStoreProducer.produceCoreSchemaStore();

        assertThat(result, is(sameInstance(mongoCoreSchemaStore)));
    }

    @Test
    void return_classpath_core_schema_store_when_database_mode_is_github() {
        coreSchemaStoreProducer.databaseMode = DatabaseMode.GITHUB;

        CoreSchemaStore result = coreSchemaStoreProducer.produceCoreSchemaStore();

        assertThat(result, is(sameInstance(classpathCoreSchemaStore)));
    }
}