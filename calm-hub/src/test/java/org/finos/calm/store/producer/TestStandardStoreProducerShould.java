package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.mongo.MongoStandardStore;
import org.finos.calm.store.nitrite.NitriteStandardStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestStandardStoreProducerShould {

    @InjectMock
    MongoStandardStore mongoStandardStore;

    @InjectMock
    NitriteStandardStore nitriteStandardStore;

    private StandardStoreProducer standardStoreProducer;

    @BeforeEach
    void setup() {
        standardStoreProducer = new StandardStoreProducer();
        standardStoreProducer.mongoStandardStore = mongoStandardStore;
        standardStoreProducer.standaloneStandardStore = nitriteStandardStore;
    }

    @Test
    void return_mongo_standard_store_when_database_mode_is_mongo() {
        // Given
        standardStoreProducer.databaseMode = "mongo";

        // When
        StandardStore result = standardStoreProducer.produceStandardStore();

        // Then
        assertThat(result, is(sameInstance(mongoStandardStore)));
    }

    @Test
    void return_nitrite_standard_store_when_database_mode_is_standalone() {
        // Given
        standardStoreProducer.databaseMode = "standalone";

        // When
        StandardStore result = standardStoreProducer.produceStandardStore();

        // Then
        assertThat(result, is(sameInstance(nitriteStandardStore)));
    }

    @Test
    void return_mongo_standard_store_when_database_mode_is_not_recognized() {
        // Given
        standardStoreProducer.databaseMode = "unknown";

        // When
        StandardStore result = standardStoreProducer.produceStandardStore();

        // Then
        assertThat(result, is(sameInstance(mongoStandardStore)));
    }
}