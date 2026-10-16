package org.finos.calm.store.producer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.sameInstance;
import static org.mockito.Mockito.when;

import jakarta.enterprise.inject.Instance;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.DocumentStore;
import org.finos.calm.store.github.GitHubDocumentStore;
import org.finos.calm.store.mongo.MongoDocumentStore;
import org.finos.calm.store.nitrite.NitriteDocumentStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TestDocumentStoreProducerShould {

    @Mock MongoDocumentStore mockMongoStore;

    @Mock NitriteDocumentStore mockNitriteStore;

    @Mock GitHubDocumentStore mockGitHubStore;

    @Mock Instance<MongoDocumentStore> mockMongo;

    @Mock Instance<NitriteDocumentStore> mockNitrite;

    @Mock Instance<GitHubDocumentStore> mockGitHub;

    private DocumentStoreProducer producer;

    @BeforeEach
    void set_up() {
        producer = new DocumentStoreProducer();
        producer.mongo = mockMongo;
        producer.nitrite = mockNitrite;
        producer.github = mockGitHub;
    }

    @Test
    void return_mongo_store_by_default() {
        when(mockMongo.get()).thenReturn(mockMongoStore);
        producer.databaseMode = "mongo";

        assertThat(producer.produceDocumentStore(), sameInstance((DocumentStore) mockMongoStore));
    }

    @Test
    void return_nitrite_store_in_standalone_mode() {
        when(mockNitrite.get()).thenReturn(mockNitriteStore);
        producer.databaseMode = "standalone";

        assertThat(producer.produceDocumentStore(), sameInstance((DocumentStore) mockNitriteStore));
    }

    @Test
    void return_github_store_in_github_mode() {
        when(mockGitHub.get()).thenReturn(mockGitHubStore);
        producer.databaseMode = DatabaseMode.GITHUB;

        assertThat(producer.produceDocumentStore(), sameInstance((DocumentStore) mockGitHubStore));
    }
}
