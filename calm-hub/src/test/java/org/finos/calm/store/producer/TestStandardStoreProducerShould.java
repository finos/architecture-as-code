package org.finos.calm.store.producer;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.StandardStore;
import org.finos.calm.store.github.GitHubStandardStore;
import org.finos.calm.store.mongo.MongoStandardStore;
import org.finos.calm.store.nitrite.NitriteStandardStore;
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
public class TestStandardStoreProducerShould {

    @Mock
    MongoStandardStore mongoStandardStore;

    @Mock
    Instance<MongoStandardStore> mongoStandardStoreInstance;

    @Mock
    NitriteStandardStore nitriteStandardStore;

    @Mock
    Instance<NitriteStandardStore> nitriteStandardStoreInstance;

    @Mock
    GitHubStandardStore gitHubStandardStore;

    @Mock
    Instance<GitHubStandardStore> gitHubStandardStoreInstance;

    private StandardStoreProducer standardStoreProducer;

    @BeforeEach
    void setup() {
        standardStoreProducer = new StandardStoreProducer();
        when(mongoStandardStoreInstance.get()).thenReturn(mongoStandardStore);
        standardStoreProducer.mongoStandardStore = mongoStandardStoreInstance;
        when(nitriteStandardStoreInstance.get()).thenReturn(nitriteStandardStore);
        standardStoreProducer.standaloneStandardStore = nitriteStandardStoreInstance;
        when(gitHubStandardStoreInstance.get()).thenReturn(gitHubStandardStore);
        standardStoreProducer.gitHubStandardStore = gitHubStandardStoreInstance;
    }

    @Test
    void return_mongo_standard_store_when_database_mode_is_mongo() {
        // Given
        standardStoreProducer.databaseMode = "mongo";

        // When
        StandardStore result = standardStoreProducer.produceStandardStore();

        // Then
        assertThat(result, is(sameInstance(mongoStandardStore)));
    }

    @Test
    void return_nitrite_standard_store_when_database_mode_is_standalone() {
        // Given
        standardStoreProducer.databaseMode = "standalone";

        // When
        StandardStore result = standardStoreProducer.produceStandardStore();

        // Then
        assertThat(result, is(sameInstance(nitriteStandardStore)));
    }

    @Test
    void return_mongo_standard_store_when_database_mode_is_not_recognized() {
        standardStoreProducer.databaseMode = "unknown";

        StandardStore result = standardStoreProducer.produceStandardStore();

        assertThat(result, is(sameInstance(mongoStandardStore)));
    }

    @Test
    void return_github_standard_store_when_database_mode_is_github() {
        standardStoreProducer.databaseMode = DatabaseMode.GITHUB;

        StandardStore result = standardStoreProducer.produceStandardStore();

        assertThat(result, is(sameInstance(gitHubStandardStore)));
    }
}