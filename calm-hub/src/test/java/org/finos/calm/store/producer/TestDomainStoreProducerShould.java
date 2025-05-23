package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.mongo.MongoDomainStore;
import org.finos.calm.store.nitrite.NitriteDomainStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestDomainStoreProducerShould {

    @InjectMock
    MongoDomainStore mongoDomainStore;

    @InjectMock
    NitriteDomainStore nitriteDomainStore;

    private DomainStoreProducer domainStoreProducer;

    @BeforeEach
    void setup() {
        domainStoreProducer = new DomainStoreProducer();
        domainStoreProducer.mongoDomainStore = mongoDomainStore;
        domainStoreProducer.standaloneDomainStore = nitriteDomainStore;
    }

    @Test
    void return_mongo_domain_store_when_database_mode_is_mongo() {
        // Given
        domainStoreProducer.databaseMode = "mongo";

        // When
        DomainStore result = domainStoreProducer.produceDomainStore();

        // Then
        assertThat(result, is(sameInstance(mongoDomainStore)));
    }

    @Test
    void return_nitrite_domain_store_when_database_mode_is_standalone() {
        // Given
        domainStoreProducer.databaseMode = "standalone";

        // When
        DomainStore result = domainStoreProducer.produceDomainStore();

        // Then
        assertThat(result, is(sameInstance(nitriteDomainStore)));
    }

    @Test
    void return_mongo_domain_store_when_database_mode_is_not_recognized() {
        // Given
        domainStoreProducer.databaseMode = "unknown";

        // When
        DomainStore result = domainStoreProducer.produceDomainStore();

        // Then
        assertThat(result, is(sameInstance(mongoDomainStore)));
    }
}