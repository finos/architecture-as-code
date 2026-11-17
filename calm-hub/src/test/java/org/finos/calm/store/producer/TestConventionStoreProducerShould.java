package org.finos.calm.store.producer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.sameInstance;
import static org.mockito.Mockito.when;

import jakarta.enterprise.inject.Instance;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.ConventionStore;
import org.finos.calm.store.github.GitHubConventionStore;
import org.finos.calm.store.mongo.MongoConventionStore;
import org.finos.calm.store.nitrite.NitriteConventionStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TestConventionStoreProducerShould {

    @Mock MongoConventionStore mockMongoStore;

    @Mock NitriteConventionStore mockNitriteStore;

    @Mock GitHubConventionStore mockGitHubStore;

    @Mock Instance<MongoConventionStore> mockMongo;

    @Mock Instance<NitriteConventionStore> mockNitrite;

    @Mock Instance<GitHubConventionStore> mockGitHub;

    private ConventionStoreProducer producer;

    @BeforeEach
    void set_up() {
        producer = new ConventionStoreProducer();
        producer.mongo = mockMongo;
        producer.nitrite = mockNitrite;
        producer.github = mockGitHub;
    }

    @Test
    void return_mongo_store_by_default() {
        when(mockMongo.get()).thenReturn(mockMongoStore);
        producer.databaseMode = "mongo";

        assertThat(producer.produceConventionStore(), sameInstance((ConventionStore) mockMongoStore));
    }

    @Test
    void return_nitrite_store_in_standalone_mode() {
        when(mockNitrite.get()).thenReturn(mockNitriteStore);
        producer.databaseMode = "standalone";

        assertThat(producer.produceConventionStore(), sameInstance((ConventionStore) mockNitriteStore));
    }

    @Test
    void return_github_store_in_github_mode() {
        when(mockGitHub.get()).thenReturn(mockGitHubStore);
        producer.databaseMode = DatabaseMode.GITHUB;

        assertThat(producer.produceConventionStore(), sameInstance((ConventionStore) mockGitHubStore));
    }
}
