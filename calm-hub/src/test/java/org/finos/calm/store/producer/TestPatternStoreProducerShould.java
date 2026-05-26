package org.finos.calm.store.producer;

import org.finos.calm.store.PatternStore;
import org.finos.calm.store.mongo.MongoPatternStore;
import org.finos.calm.store.nitrite.NitritePatternStore;
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
public class TestPatternStoreProducerShould {

    @Mock
    MongoPatternStore mongoPatternStore;

    @Mock
    Instance<MongoPatternStore> mongoPatternStoreInstance;

    @Mock
    NitritePatternStore nitritePatternStore;

    @Mock
    Instance<NitritePatternStore> nitritePatternStoreInstance;

    private PatternStoreProducer patternStoreProducer;

    @BeforeEach
    void setup() {
        patternStoreProducer = new PatternStoreProducer();
        when(mongoPatternStoreInstance.get()).thenReturn(mongoPatternStore);
        patternStoreProducer.mongoPatternStore = mongoPatternStoreInstance;
        when(nitritePatternStoreInstance.get()).thenReturn(nitritePatternStore);
        patternStoreProducer.standalonePatternStore = nitritePatternStoreInstance;
    }

    @Test
    void return_mongo_pattern_store_when_database_mode_is_mongo() {
        // Given
        patternStoreProducer.databaseMode = "mongo";

        // When
        PatternStore result = patternStoreProducer.producePatternStore();

        // Then
        assertThat(result, is(sameInstance(mongoPatternStore)));
    }

    @Test
    void return_nitrite_pattern_store_when_database_mode_is_standalone() {
        // Given
        patternStoreProducer.databaseMode = "standalone";

        // When
        PatternStore result = patternStoreProducer.producePatternStore();

        // Then
        assertThat(result, is(sameInstance(nitritePatternStore)));
    }

    @Test
    void return_mongo_pattern_store_when_database_mode_is_not_recognized() {
        // Given
        patternStoreProducer.databaseMode = "unknown";

        // When
        PatternStore result = patternStoreProducer.producePatternStore();

        // Then
        assertThat(result, is(sameInstance(mongoPatternStore)));
    }
}