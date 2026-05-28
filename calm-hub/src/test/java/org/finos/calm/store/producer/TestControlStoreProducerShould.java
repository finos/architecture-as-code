package org.finos.calm.store.producer;

import org.finos.calm.store.ControlStore;
import org.finos.calm.store.mongo.MongoControlStore;
import org.finos.calm.store.nitrite.NitriteControlStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import jakarta.enterprise.inject.Instance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.when;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
public class TestControlStoreProducerShould {

    @Mock
    MongoControlStore mongoControlStore;

    @Mock
    Instance<MongoControlStore> mongoControlStoreInstance;

    @Mock
    NitriteControlStore standaloneControlStore;

    @Mock
    Instance<NitriteControlStore> standaloneControlStoreInstance;

    ControlStoreProducer producer;

    @BeforeEach
    public void setup() {
        when(mongoControlStoreInstance.get()).thenReturn(mongoControlStore);
        when(standaloneControlStoreInstance.get()).thenReturn(standaloneControlStore);
        producer = new ControlStoreProducer();
        producer.mongoControlStore = mongoControlStoreInstance;
        producer.standaloneControlStore = standaloneControlStoreInstance;
    }

    @Test
    public void return_mongo_store_when_database_mode_is_mongo() {
        producer.databaseMode = "mongo";
        ControlStore result = producer.produceControlStore();
        assertNotNull(result);
        assertEquals(mongoControlStore, result);
    }

    @Test
    public void return_standalone_store_when_database_mode_is_standalone() {
        producer.databaseMode = "standalone";
        ControlStore result = producer.produceControlStore();
        assertNotNull(result);
        assertEquals(standaloneControlStore, result);
    }

    @Test
    public void return_mongo_store_when_database_mode_is_not_standalone() {
        producer.databaseMode = "some-other-mode";
        ControlStore result = producer.produceControlStore();
        assertNotNull(result);
        assertEquals(mongoControlStore, result);
    }

    @Test
    public void return_mongo_store_when_database_mode_is_null() {
        producer.databaseMode = null;
        ControlStore result = producer.produceControlStore();
        assertNotNull(result);
        assertEquals(mongoControlStore, result);
    }
}
