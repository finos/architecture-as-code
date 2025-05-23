package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.mongo.MongoFlowStore;
import org.finos.calm.store.nitrite.NitriteFlowStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestFlowStoreProducerShould {

    @InjectMock
    MongoFlowStore mongoFlowStore;

    @InjectMock
    NitriteFlowStore nitriteFlowStore;

    private FlowStoreProducer flowStoreProducer;

    @BeforeEach
    void setup() {
        flowStoreProducer = new FlowStoreProducer();
        flowStoreProducer.mongoFlowStore = mongoFlowStore;
        flowStoreProducer.standaloneFlowStore = nitriteFlowStore;
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