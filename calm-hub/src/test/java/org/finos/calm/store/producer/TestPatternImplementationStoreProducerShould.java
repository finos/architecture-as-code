package org.finos.calm.store.producer;

import jakarta.enterprise.inject.Instance;
import org.finos.calm.store.PatternImplementationStore;
import org.finos.calm.store.mongo.MongoPatternImplementationStore;
import org.finos.calm.store.nitrite.NitritePatternImplementationStore;
import org.finos.calm.store.noop.NoOpPatternImplementationStore;
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
public class TestPatternImplementationStoreProducerShould {

    @Mock
    MongoPatternImplementationStore mongoStore;

    @Mock
    Instance<MongoPatternImplementationStore> mongoStoreInstance;

    @Mock
    NitritePatternImplementationStore nitriteStore;

    @Mock
    Instance<NitritePatternImplementationStore> nitriteStoreInstance;

    @Mock
    NoOpPatternImplementationStore gitHubStore;

    @Mock
    Instance<NoOpPatternImplementationStore> gitHubStoreInstance;

    private PatternImplementationStoreProducer producer;

    @BeforeEach
    void setup() {
        producer = new PatternImplementationStoreProducer();
        when(mongoStoreInstance.get()).thenReturn(mongoStore);
        producer.mongoStore = mongoStoreInstance;
        when(nitriteStoreInstance.get()).thenReturn(nitriteStore);
        producer.standaloneStore = nitriteStoreInstance;
        when(gitHubStoreInstance.get()).thenReturn(gitHubStore);
        producer.gitHubStore = gitHubStoreInstance;
    }

    @Test
    void return_mongo_store_when_database_mode_is_mongo() {
        producer.databaseMode = "mongo";

        PatternImplementationStore result = producer.producePatternImplementationStore();

        assertThat(result, is(sameInstance(mongoStore)));
    }

    @Test
    void return_nitrite_store_when_database_mode_is_standalone() {
        producer.databaseMode = "standalone";

        PatternImplementationStore result = producer.producePatternImplementationStore();

        assertThat(result, is(sameInstance(nitriteStore)));
    }

    @Test
    void return_noop_store_when_database_mode_is_github() {
        producer.databaseMode = "github";

        PatternImplementationStore result = producer.producePatternImplementationStore();

        assertThat(result, is(sameInstance(gitHubStore)));
    }

    @Test
    void return_mongo_store_when_database_mode_is_not_recognized() {
        producer.databaseMode = "unknown";

        PatternImplementationStore result = producer.producePatternImplementationStore();

        assertThat(result, is(sameInstance(mongoStore)));
    }
}
