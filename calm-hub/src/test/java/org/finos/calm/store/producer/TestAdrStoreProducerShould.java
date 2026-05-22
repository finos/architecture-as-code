package org.finos.calm.store.producer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

import org.finos.calm.store.AdrStore;
import org.finos.calm.store.mongo.MongoAdrStore;
import org.finos.calm.store.nitrite.NitriteAdrStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import jakarta.enterprise.inject.Instance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.when;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;


@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
public class TestAdrStoreProducerShould {

    @Mock
    MongoAdrStore mongoAdrStore;

    @Mock
    Instance<MongoAdrStore> mongoAdrStoreInstance;

    @Mock
    NitriteAdrStore nitriteAdrStore;

    @Mock
    Instance<NitriteAdrStore> nitriteAdrStoreInstance;

    private AdrStoreProducer adrStoreProducer;

    @BeforeEach
    void setup() {
        adrStoreProducer = new AdrStoreProducer();
        when(mongoAdrStoreInstance.get()).thenReturn(mongoAdrStore);
        adrStoreProducer.mongoAdrStore = mongoAdrStoreInstance;
        when(nitriteAdrStoreInstance.get()).thenReturn(nitriteAdrStore);
        adrStoreProducer.standaloneAdrStore = nitriteAdrStoreInstance;
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