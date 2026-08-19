package org.finos.calm.store.producer;

import jakarta.enterprise.inject.Instance;
import org.finos.calm.store.DocumentStore;
import org.finos.calm.store.mongo.MongoDocumentStore;
import org.finos.calm.store.nitrite.NitriteDocumentStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.sameInstance;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestDocumentStoreProducerShould {
    @Mock MongoDocumentStore mongoStore;
    @Mock NitriteDocumentStore nitriteStore;
    @Mock Instance<MongoDocumentStore> mongo;
    @Mock Instance<NitriteDocumentStore> nitrite;
    private DocumentStoreProducer producer;
    @BeforeEach void setUp() { producer = new DocumentStoreProducer(); producer.mongo = mongo; producer.nitrite = nitrite; }
    @Test void return_mongo_store_by_default() { when(mongo.get()).thenReturn(mongoStore); producer.databaseMode = "mongo"; assertThat(producer.produceDocumentStore(), sameInstance((DocumentStore) mongoStore)); }
    @Test void return_nitrite_store_in_standalone_mode() { when(nitrite.get()).thenReturn(nitriteStore); producer.databaseMode = "standalone"; assertThat(producer.produceDocumentStore(), sameInstance((DocumentStore) nitriteStore)); }
}
