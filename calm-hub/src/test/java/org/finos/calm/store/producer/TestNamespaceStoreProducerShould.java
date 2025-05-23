package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.mongo.MongoNamespaceStore;
import org.finos.calm.store.nitrite.NitriteNamespaceStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestNamespaceStoreProducerShould {

    @InjectMock
    MongoNamespaceStore mongoNamespaceStore;

    @InjectMock
    NitriteNamespaceStore nitriteNamespaceStore;

    private NamespaceStoreProducer namespaceStoreProducer;

    @BeforeEach
    void setup() {
        namespaceStoreProducer = new NamespaceStoreProducer();
        namespaceStoreProducer.mongoNamespaceStore = mongoNamespaceStore;
        namespaceStoreProducer.standaloneNamespaceStore = nitriteNamespaceStore;
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