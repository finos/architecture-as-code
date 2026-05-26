package org.finos.calm.store.producer;

import org.finos.calm.store.DomainStore;
import org.finos.calm.store.mongo.MongoDomainStore;
import org.finos.calm.store.nitrite.NitriteDomainStore;
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
public class TestDomainStoreProducerShould {

    @Mock
    MongoDomainStore mongoDomainStore;

    @Mock
    Instance<MongoDomainStore> mongoDomainStoreInstance;

    @Mock
    NitriteDomainStore nitriteDomainStore;

    @Mock
    Instance<NitriteDomainStore> nitriteDomainStoreInstance;

    private DomainStoreProducer domainStoreProducer;

    @BeforeEach
    void setup() {
        domainStoreProducer = new DomainStoreProducer();
        when(mongoDomainStoreInstance.get()).thenReturn(mongoDomainStore);
        domainStoreProducer.mongoDomainStore = mongoDomainStoreInstance;
        when(nitriteDomainStoreInstance.get()).thenReturn(nitriteDomainStore);
        domainStoreProducer.standaloneDomainStore = nitriteDomainStoreInstance;
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