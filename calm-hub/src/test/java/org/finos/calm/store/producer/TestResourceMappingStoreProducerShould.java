package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.ResourceMappingStore;
import org.finos.calm.store.mongo.MongoResourceMappingStore;
import org.finos.calm.store.nitrite.NitriteResourceMappingStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestResourceMappingStoreProducerShould {

    @InjectMock
    MongoResourceMappingStore mongoResourceMappingStore;

    @InjectMock
    NitriteResourceMappingStore nitriteResourceMappingStore;

    private ResourceMappingStoreProducer producer;

    @BeforeEach
    void setup() {
        producer = new ResourceMappingStoreProducer();
        producer.mongoResourceMappingStore = mongoResourceMappingStore;
        producer.standaloneResourceMappingStore = nitriteResourceMappingStore;
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
