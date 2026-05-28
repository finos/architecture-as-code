package org.finos.calm.store.producer;

import org.finos.calm.store.SearchStore;
import org.finos.calm.store.mongo.MongoSearchStore;
import org.finos.calm.store.nitrite.NitriteSearchStore;
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
public class TestSearchStoreProducerShould {

    @Mock
    MongoSearchStore mongoSearchStore;

    @Mock
    Instance<MongoSearchStore> mongoSearchStoreInstance;

    @Mock
    NitriteSearchStore nitriteSearchStore;

    @Mock
    Instance<NitriteSearchStore> nitriteSearchStoreInstance;

    private SearchStoreProducer searchStoreProducer;

    @BeforeEach
    void setup() {
        searchStoreProducer = new SearchStoreProducer();
        when(mongoSearchStoreInstance.get()).thenReturn(mongoSearchStore);
        searchStoreProducer.mongoSearchStore = mongoSearchStoreInstance;
        when(nitriteSearchStoreInstance.get()).thenReturn(nitriteSearchStore);
        searchStoreProducer.standaloneSearchStore = nitriteSearchStoreInstance;
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
