package org.finos.calm.store.producer;

import jakarta.enterprise.inject.Instance;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.SchemaVersionStore;
import org.finos.calm.store.mongo.MongoSchemaVersionStore;
import org.finos.calm.store.nitrite.NitriteSchemaVersionStore;
import org.finos.calm.store.noop.NoOpSchemaVersionStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestSchemaVersionStoreProducerShould {

    @Mock
    MongoSchemaVersionStore mongoSchemaVersionStore;

    @Mock
    Instance<MongoSchemaVersionStore> mongoSchemaVersionStoreInstance;

    @Mock
    NitriteSchemaVersionStore nitriteSchemaVersionStore;

    @Mock
    Instance<NitriteSchemaVersionStore> nitriteSchemaVersionStoreInstance;

    @Mock
    NoOpSchemaVersionStore noOpSchemaVersionStore;

    @Mock
    Instance<NoOpSchemaVersionStore> noOpSchemaVersionStoreInstance;

    private SchemaVersionStoreProducer producer;

    @BeforeEach
    void setup() {
        producer = new SchemaVersionStoreProducer();
        when(mongoSchemaVersionStoreInstance.get()).thenReturn(mongoSchemaVersionStore);
        producer.mongoSchemaVersionStore = mongoSchemaVersionStoreInstance;
        when(nitriteSchemaVersionStoreInstance.get()).thenReturn(nitriteSchemaVersionStore);
        producer.standaloneSchemaVersionStore = nitriteSchemaVersionStoreInstance;
        when(noOpSchemaVersionStoreInstance.get()).thenReturn(noOpSchemaVersionStore);
        producer.noOpSchemaVersionStore = noOpSchemaVersionStoreInstance;
    }

    @Test
    void return_mongo_schema_version_store_when_database_mode_is_mongo() {
        producer.databaseMode = DatabaseMode.MONGO;

        SchemaVersionStore result = producer.produceSchemaVersionStore();

        assertThat(result, is(sameInstance(mongoSchemaVersionStore)));
    }

    @Test
    void return_nitrite_schema_version_store_when_database_mode_is_standalone() {
        producer.databaseMode = DatabaseMode.STANDALONE;

        SchemaVersionStore result = producer.produceSchemaVersionStore();

        assertThat(result, is(sameInstance(nitriteSchemaVersionStore)));
    }

    @Test
    void return_mongo_schema_version_store_when_database_mode_is_not_recognized() {
        producer.databaseMode = "unknown";

        SchemaVersionStore result = producer.produceSchemaVersionStore();

        assertThat(result, is(sameInstance(mongoSchemaVersionStore)));
    }

    @Test
    void return_noop_schema_version_store_when_database_mode_is_github() {
        producer.databaseMode = DatabaseMode.GITHUB;

        SchemaVersionStore result = producer.produceSchemaVersionStore();

        assertThat(result, is(sameInstance(noOpSchemaVersionStore)));
    }
}
