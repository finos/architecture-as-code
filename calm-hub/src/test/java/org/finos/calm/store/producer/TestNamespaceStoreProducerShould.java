package org.finos.calm.store.producer;

import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.mongo.MongoNamespaceStore;
import org.finos.calm.store.nitrite.NitriteNamespaceStore;
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
public class TestNamespaceStoreProducerShould {

    @Mock
    MongoNamespaceStore mongoNamespaceStore;

    @Mock
    Instance<MongoNamespaceStore> mongoNamespaceStoreInstance;

    @Mock
    NitriteNamespaceStore nitriteNamespaceStore;

    @Mock
    Instance<NitriteNamespaceStore> nitriteNamespaceStoreInstance;

    private NamespaceStoreProducer namespaceStoreProducer;

    @BeforeEach
    void setup() {
        namespaceStoreProducer = new NamespaceStoreProducer();
        when(mongoNamespaceStoreInstance.get()).thenReturn(mongoNamespaceStore);
        namespaceStoreProducer.mongoNamespaceStore = mongoNamespaceStoreInstance;
        when(nitriteNamespaceStoreInstance.get()).thenReturn(nitriteNamespaceStore);
        namespaceStoreProducer.standaloneNamespaceStore = nitriteNamespaceStoreInstance;
    }

    @Test
    void return_mongo_namespace_store_when_database_mode_is_mongo() {
        // Given
        namespaceStoreProducer.databaseMode = "mongo";

        // When
        NamespaceStore result = namespaceStoreProducer.produceNamespaceStore();

        // Then
        assertThat(result, is(sameInstance(mongoNamespaceStore)));
    }

    @Test
    void return_nitrite_namespace_store_when_database_mode_is_standalone() {
        // Given
        namespaceStoreProducer.databaseMode = "standalone";

        // When
        NamespaceStore result = namespaceStoreProducer.produceNamespaceStore();

        // Then
        assertThat(result, is(sameInstance(nitriteNamespaceStore)));
    }

    @Test
    void return_mongo_namespace_store_when_database_mode_is_not_recognized() {
        // Given
        namespaceStoreProducer.databaseMode = "unknown";

        // When
        NamespaceStore result = namespaceStoreProducer.produceNamespaceStore();

        // Then
        assertThat(result, is(sameInstance(mongoNamespaceStore)));
    }
}