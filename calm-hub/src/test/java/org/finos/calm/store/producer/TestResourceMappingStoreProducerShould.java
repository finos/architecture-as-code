package org.finos.calm.store.producer;

import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.mongo.MongoResourceMappingStore;
import org.finos.calm.store.nitrite.NitriteResourceMappingStore;
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
public class TestResourceMappingStoreProducerShould {

    @Mock
    MongoResourceMappingStore mongoResourceMappingStore;

    @Mock
    Instance<MongoResourceMappingStore> mongoResourceMappingStoreInstance;

    @Mock
    NitriteResourceMappingStore nitriteResourceMappingStore;

    @Mock
    Instance<NitriteResourceMappingStore> nitriteResourceMappingStoreInstance;

    private ResourceMappingStoreProducer producer;

    @BeforeEach
    void setup() {
        producer = new ResourceMappingStoreProducer();
        when(mongoResourceMappingStoreInstance.get()).thenReturn(mongoResourceMappingStore);
        producer.mongoResourceMappingStore = mongoResourceMappingStoreInstance;
        when(nitriteResourceMappingStoreInstance.get()).thenReturn(nitriteResourceMappingStore);
        producer.standaloneResourceMappingStore = nitriteResourceMappingStoreInstance;
    }

    @Test
    void return_mongo_store_when_database_mode_is_mongo() {
        producer.databaseMode = "mongo";

        ResourceMappingStore result = producer.produceResourceMappingStore();

        assertThat(result, is(sameInstance(mongoResourceMappingStore)));
    }

    @Test
    void return_nitrite_store_when_database_mode_is_standalone() {
        producer.databaseMode = "standalone";

        ResourceMappingStore result = producer.produceResourceMappingStore();

        assertThat(result, is(sameInstance(nitriteResourceMappingStore)));
    }

    @Test
    void return_mongo_store_when_database_mode_is_not_recognized() {
        producer.databaseMode = "unknown";

        ResourceMappingStore result = producer.produceResourceMappingStore();

        assertThat(result, is(sameInstance(mongoResourceMappingStore)));
    }
}
