package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.mongo.MongoArchitectureStore;
import org.finos.calm.store.nitrite.NitriteArchitectureStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestArchitectureStoreProducerShould {

    @InjectMock
    MongoArchitectureStore mongoArchitectureStore;

    @InjectMock
    NitriteArchitectureStore nitriteArchitectureStore;

    private ArchitectureStoreProducer architectureStoreProducer;

    @BeforeEach
    void setup() {
        architectureStoreProducer = new ArchitectureStoreProducer();
        architectureStoreProducer.mongoArchitectureStore = mongoArchitectureStore;
        architectureStoreProducer.standaloneArchitectureStore = nitriteArchitectureStore;
    }

    @Test
    void return_mongo_architecture_store_when_database_mode_is_mongo() {
        // Given
        architectureStoreProducer.databaseMode = "mongo";

        // When
        ArchitectureStore result = architectureStoreProducer.produceArchitectureStore();

        // Then
        assertThat(result, is(sameInstance(mongoArchitectureStore)));
    }

    @Test
    void return_nitrite_architecture_store_when_database_mode_is_standalone() {
        // Given
        architectureStoreProducer.databaseMode = "standalone";

        // When
        ArchitectureStore result = architectureStoreProducer.produceArchitectureStore();

        // Then
        assertThat(result, is(sameInstance(nitriteArchitectureStore)));
    }

    @Test
    void return_mongo_architecture_store_when_database_mode_is_not_recognized() {
        // Given
        architectureStoreProducer.databaseMode = "unknown";

        // When
        ArchitectureStore result = architectureStoreProducer.produceArchitectureStore();

        // Then
        assertThat(result, is(sameInstance(mongoArchitectureStore)));
    }
}