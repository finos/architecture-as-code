package org.finos.calm.store.producer;

import org.finos.calm.store.FlowStore;
import org.finos.calm.store.mongo.MongoFlowStore;
import org.finos.calm.store.nitrite.NitriteFlowStore;
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
public class TestFlowStoreProducerShould {

    @Mock
    MongoFlowStore mongoFlowStore;

    @Mock
    Instance<MongoFlowStore> mongoFlowStoreInstance;

    @Mock
    NitriteFlowStore nitriteFlowStore;

    @Mock
    Instance<NitriteFlowStore> nitriteFlowStoreInstance;

    private FlowStoreProducer flowStoreProducer;

    @BeforeEach
    void setup() {
        flowStoreProducer = new FlowStoreProducer();
        when(mongoFlowStoreInstance.get()).thenReturn(mongoFlowStore);
        flowStoreProducer.mongoFlowStore = mongoFlowStoreInstance;
        when(nitriteFlowStoreInstance.get()).thenReturn(nitriteFlowStore);
        flowStoreProducer.standaloneFlowStore = nitriteFlowStoreInstance;
    }

    @Test
    void return_mongo_flow_store_when_database_mode_is_mongo() {
        // Given
        flowStoreProducer.databaseMode = "mongo";

        // When
        FlowStore result = flowStoreProducer.produceFlowStore();

        // Then
        assertThat(result, is(sameInstance(mongoFlowStore)));
    }

    @Test
    void return_nitrite_flow_store_when_database_mode_is_standalone() {
        // Given
        flowStoreProducer.databaseMode = "standalone";

        // When
        FlowStore result = flowStoreProducer.produceFlowStore();

        // Then
        assertThat(result, is(sameInstance(nitriteFlowStore)));
    }

    @Test
    void return_mongo_flow_store_when_database_mode_is_not_recognized() {
        // Given
        flowStoreProducer.databaseMode = "unknown";

        // When
        FlowStore result = flowStoreProducer.produceFlowStore();

        // Then
        assertThat(result, is(sameInstance(mongoFlowStore)));
    }
}