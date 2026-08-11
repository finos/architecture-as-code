package org.finos.calm.store.producer;

import org.finos.calm.store.PatternLayoutStore;
import org.finos.calm.store.mongo.MongoPatternLayoutStore;
import org.finos.calm.store.nitrite.NitritePatternLayoutStore;
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
public class TestPatternLayoutStoreProducerShould {

    @Mock
    MongoPatternLayoutStore mongoPatternLayoutStore;

    @Mock
    Instance<MongoPatternLayoutStore> mongoPatternLayoutStoreInstance;

    @Mock
    NitritePatternLayoutStore nitritePatternLayoutStore;

    @Mock
    Instance<NitritePatternLayoutStore> nitritePatternLayoutStoreInstance;

    private PatternLayoutStoreProducer patternLayoutStoreProducer;

    @BeforeEach
    void setup() {
        patternLayoutStoreProducer = new PatternLayoutStoreProducer();
        when(mongoPatternLayoutStoreInstance.get()).thenReturn(mongoPatternLayoutStore);
        patternLayoutStoreProducer.mongoPatternLayoutStore = mongoPatternLayoutStoreInstance;
        when(nitritePatternLayoutStoreInstance.get()).thenReturn(nitritePatternLayoutStore);
        patternLayoutStoreProducer.nitritePatternLayoutStore = nitritePatternLayoutStoreInstance;
    }

    @Test
    void return_mongo_pattern_layout_store_when_database_mode_is_mongo() {
        // Given
        patternLayoutStoreProducer.databaseMode = "mongo";

        // When
        PatternLayoutStore result = patternLayoutStoreProducer.producePatternLayoutStore();

        // Then
        assertThat(result, is(sameInstance(mongoPatternLayoutStore)));
    }

    @Test
    void return_nitrite_pattern_layout_store_when_database_mode_is_standalone() {
        // Given
        patternLayoutStoreProducer.databaseMode = "standalone";

        // When
        PatternLayoutStore result = patternLayoutStoreProducer.producePatternLayoutStore();

        // Then
        assertThat(result, is(sameInstance(nitritePatternLayoutStore)));
    }

    @Test
    void return_mongo_pattern_layout_store_when_database_mode_is_not_recognized() {
        // Given
        patternLayoutStoreProducer.databaseMode = "unknown";

        // When
        PatternLayoutStore result = patternLayoutStoreProducer.producePatternLayoutStore();

        // Then
        assertThat(result, is(sameInstance(mongoPatternLayoutStore)));
    }
}
