package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.mongo.MongoPatternStore;
import org.finos.calm.store.nitrite.NitritePatternStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestPatternStoreProducerShould {

    @InjectMock
    MongoPatternStore mongoPatternStore;

    @InjectMock
    NitritePatternStore nitritePatternStore;

    private PatternStoreProducer patternStoreProducer;

    @BeforeEach
    void setup() {
        patternStoreProducer = new PatternStoreProducer();
        patternStoreProducer.mongoPatternStore = mongoPatternStore;
        patternStoreProducer.standalonePatternStore = nitritePatternStore;
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