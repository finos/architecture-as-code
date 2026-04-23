package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.SearchStore;
import org.finos.calm.store.mongo.MongoSearchStore;
import org.finos.calm.store.nitrite.NitriteSearchStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestSearchStoreProducerShould {

    @InjectMock
    MongoSearchStore mongoSearchStore;

    @InjectMock
    NitriteSearchStore nitriteSearchStore;

    private SearchStoreProducer searchStoreProducer;

    @BeforeEach
    void setup() {
        searchStoreProducer = new SearchStoreProducer();
        searchStoreProducer.mongoSearchStore = mongoSearchStore;
        searchStoreProducer.standaloneSearchStore = nitriteSearchStore;
    }

    @Test
    void return_mongo_search_store_when_database_mode_is_mongo() {
        searchStoreProducer.databaseMode = "mongo";

        SearchStore result = searchStoreProducer.produceSearchStore();

        assertThat(result, is(sameInstance(mongoSearchStore)));
    }

    @Test
    void return_nitrite_search_store_when_database_mode_is_standalone() {
        searchStoreProducer.databaseMode = "standalone";

        SearchStore result = searchStoreProducer.produceSearchStore();

        assertThat(result, is(sameInstance(nitriteSearchStore)));
    }

    @Test
    void return_mongo_search_store_when_database_mode_is_not_recognized() {
        searchStoreProducer.databaseMode = "unknown";

        SearchStore result = searchStoreProducer.produceSearchStore();

        assertThat(result, is(sameInstance(mongoSearchStore)));
    }
}
