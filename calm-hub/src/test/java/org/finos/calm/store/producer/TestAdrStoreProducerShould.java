package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.mongo.MongoAdrStore;
import org.finos.calm.store.nitrite.NitriteAdrStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestAdrStoreProducerShould {

    @InjectMock
    MongoAdrStore mongoAdrStore;

    @InjectMock
    NitriteAdrStore nitriteAdrStore;

    private AdrStoreProducer adrStoreProducer;

    @BeforeEach
    void setup() {
        adrStoreProducer = new AdrStoreProducer();
        adrStoreProducer.mongoAdrStore = mongoAdrStore;
        adrStoreProducer.standaloneAdrStore = nitriteAdrStore;
    }

    @Test
    void return_mongo_adr_store_when_database_mode_is_mongo() {
        // Given
        adrStoreProducer.databaseMode = "mongo";

        // When
        AdrStore result = adrStoreProducer.produceAdrStore();

        // Then
        assertThat(result, is(sameInstance(mongoAdrStore)));
    }

    @Test
    void return_nitrite_adr_store_when_database_mode_is_standalone() {
        // Given
        adrStoreProducer.databaseMode = "standalone";

        // When
        AdrStore result = adrStoreProducer.produceAdrStore();

        // Then
        assertThat(result, is(sameInstance(nitriteAdrStore)));
    }

    @Test
    void return_mongo_adr_store_when_database_mode_is_not_recognized() {
        // Given
        adrStoreProducer.databaseMode = "unknown";

        // When
        AdrStore result = adrStoreProducer.produceAdrStore();

        // Then
        assertThat(result, is(sameInstance(mongoAdrStore)));
    }
}