package org.finos.calm.store.producer;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.github.GitHubArchitectureStore;
import org.finos.calm.store.mongo.MongoArchitectureStore;
import org.finos.calm.store.nitrite.NitriteArchitectureStore;
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
public class TestArchitectureStoreProducerShould {

    @Mock
    MongoArchitectureStore mongoArchitectureStore;

    @Mock
    Instance<MongoArchitectureStore> mongoArchitectureStoreInstance;

    @Mock
    NitriteArchitectureStore nitriteArchitectureStore;

    @Mock
    Instance<NitriteArchitectureStore> nitriteArchitectureStoreInstance;


    @Mock
    GitHubArchitectureStore gitHubArchitectureStore;

    @Mock
    Instance<GitHubArchitectureStore> gitHubArchitectureStoreInstance;
    private ArchitectureStoreProducer architectureStoreProducer;

    @BeforeEach
    void setup() {
        architectureStoreProducer = new ArchitectureStoreProducer();
        when(mongoArchitectureStoreInstance.get()).thenReturn(mongoArchitectureStore);
        architectureStoreProducer.mongoArchitectureStore = mongoArchitectureStoreInstance;
        when(nitriteArchitectureStoreInstance.get()).thenReturn(nitriteArchitectureStore);
        architectureStoreProducer.standaloneArchitectureStore = nitriteArchitectureStoreInstance;
        when(gitHubArchitectureStoreInstance.get()).thenReturn(gitHubArchitectureStore);
        architectureStoreProducer.gitHubArchitectureStore = gitHubArchitectureStoreInstance;
    }

    @Test
    void return_mongo_architecture_store_when_database_mode_is_mongo() {
        // Given
        architectureStoreProducer.databaseMode = "mongo";

        // When
        ArchitectureStore result = architectureStoreProducer.produceArchitectureStore();

        // Then
        assertThat(result, is(sameInstance(mongoArchitectureStore)));
    }

    @Test
    void return_nitrite_architecture_store_when_database_mode_is_standalone() {
        // Given
        architectureStoreProducer.databaseMode = "standalone";

        // When
        ArchitectureStore result = architectureStoreProducer.produceArchitectureStore();

        // Then
        assertThat(result, is(sameInstance(nitriteArchitectureStore)));
    }

    @Test
    void return_mongo_architecture_store_when_database_mode_is_not_recognized() {
        architectureStoreProducer.databaseMode = "unknown";

        ArchitectureStore result = architectureStoreProducer.produceArchitectureStore();

        assertThat(result, is(sameInstance(mongoArchitectureStore)));
    }

    @Test
    void return_github_architecture_store_when_database_mode_is_github() {
        architectureStoreProducer.databaseMode = DatabaseMode.GITHUB;

        ArchitectureStore result = architectureStoreProducer.produceArchitectureStore();

        assertThat(result, is(sameInstance(gitHubArchitectureStore)));
    }
}