package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.CoreSchemaStore;
import org.finos.calm.store.mongo.MongoCoreSchemaStore;
import org.finos.calm.store.nitrite.NitriteCoreSchemaStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestCoreSchemaStoreProducerShould {

    @InjectMock
    MongoCoreSchemaStore mongoCoreSchemaStore;

    @InjectMock
    NitriteCoreSchemaStore nitriteCoreSchemaStore;

    private CoreSchemaStoreProducer coreSchemaStoreProducer;

    @BeforeEach
    void setup() {
        coreSchemaStoreProducer = new CoreSchemaStoreProducer();
        coreSchemaStoreProducer.mongoCoreSchemaStore = mongoCoreSchemaStore;
        coreSchemaStoreProducer.standaloneCoreSchemaStore = nitriteCoreSchemaStore;
    }

    @Test
    void return_mongo_core_schema_store_when_database_mode_is_mongo() {
        // Given
        coreSchemaStoreProducer.databaseMode = "mongo";

        // When
        CoreSchemaStore result = coreSchemaStoreProducer.produceCoreSchemaStore();

        // Then
        assertThat(result, is(sameInstance(mongoCoreSchemaStore)));
    }

    @Test
    void return_nitrite_core_schema_store_when_database_mode_is_standalone() {
        // Given
        coreSchemaStoreProducer.databaseMode = "standalone";

        // When
        CoreSchemaStore result = coreSchemaStoreProducer.produceCoreSchemaStore();

        // Then
        assertThat(result, is(sameInstance(nitriteCoreSchemaStore)));
    }

    @Test
    void return_mongo_core_schema_store_when_database_mode_is_not_recognized() {
        // Given
        coreSchemaStoreProducer.databaseMode = "unknown";

        // When
        CoreSchemaStore result = coreSchemaStoreProducer.produceCoreSchemaStore();

        // Then
        assertThat(result, is(sameInstance(mongoCoreSchemaStore)));
    }
}