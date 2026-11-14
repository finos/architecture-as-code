package org.finos.calm.store.producer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.sameInstance;
import static org.mockito.Mockito.when;

import jakarta.enterprise.inject.Instance;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.ConfigStore;
import org.finos.calm.store.github.GitHubConfigStore;
import org.finos.calm.store.mongo.MongoConfigStore;
import org.finos.calm.store.nitrite.NitriteConfigStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TestConfigStoreProducerShould {

    @Mock MongoConfigStore mockMongoStore;

    @Mock NitriteConfigStore mockNitriteStore;

    @Mock GitHubConfigStore mockGitHubStore;

    @Mock Instance<MongoConfigStore> mockMongo;

    @Mock Instance<NitriteConfigStore> mockNitrite;

    @Mock Instance<GitHubConfigStore> mockGitHub;

    private ConfigStoreProducer producer;

    @BeforeEach
    void set_up() {
        producer = new ConfigStoreProducer();
        producer.mongo = mockMongo;
        producer.nitrite = mockNitrite;
        producer.github = mockGitHub;
    }

    @Test
    void return_mongo_store_by_default() {
        when(mockMongo.get()).thenReturn(mockMongoStore);
        producer.databaseMode = "mongo";

        assertThat(producer.produceConfigStore(), sameInstance((ConfigStore) mockMongoStore));
    }

    @Test
    void return_nitrite_store_in_standalone_mode() {
        when(mockNitrite.get()).thenReturn(mockNitriteStore);
        producer.databaseMode = "standalone";

        assertThat(producer.produceConfigStore(), sameInstance((ConfigStore) mockNitriteStore));
    }

    @Test
    void return_github_store_in_github_mode() {
        when(mockGitHub.get()).thenReturn(mockGitHubStore);
        producer.databaseMode = DatabaseMode.GITHUB;

        assertThat(producer.produceConfigStore(), sameInstance((ConfigStore) mockGitHubStore));
    }
}
