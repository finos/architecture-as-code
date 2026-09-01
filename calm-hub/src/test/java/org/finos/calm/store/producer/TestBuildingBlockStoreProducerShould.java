package org.finos.calm.store.producer;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.BuildingBlockStore;
import org.finos.calm.store.github.GitHubBuildingBlockStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import jakarta.enterprise.inject.Instance;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.sameInstance;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestBuildingBlockStoreProducerShould {

    @Mock
    GitHubBuildingBlockStore gitHubBuildingBlockStore;

    @Mock
    Instance<GitHubBuildingBlockStore> gitHubBuildingBlockStoreInstance;

    private BuildingBlockStoreProducer producer;

    @BeforeEach
    void setup() {
        producer = new BuildingBlockStoreProducer();
        when(gitHubBuildingBlockStoreInstance.get()).thenReturn(gitHubBuildingBlockStore);
        producer.gitHubBuildingBlockStore = gitHubBuildingBlockStoreInstance;
    }

    @Test
    void return_github_building_block_store_when_database_mode_is_github() {
        producer.databaseMode = DatabaseMode.GITHUB;

        BuildingBlockStore result = producer.produceBuildingBlockStore();

        assertThat(result, is(sameInstance(gitHubBuildingBlockStore)));
    }

    @Test
    void return_no_op_store_when_database_mode_is_mongo() {
        producer.databaseMode = DatabaseMode.MONGO;

        BuildingBlockStore result = producer.produceBuildingBlockStore();

        assertThat(result, is(notNullValue()));
    }

    @Test
    void return_no_op_store_when_database_mode_is_standalone() {
        producer.databaseMode = DatabaseMode.STANDALONE;

        BuildingBlockStore result = producer.produceBuildingBlockStore();

        assertThat(result, is(notNullValue()));
    }

    @Test
    void no_op_store_throws_on_get_building_blocks_for_namespace() {
        producer.databaseMode = DatabaseMode.MONGO;
        BuildingBlockStore noOpStore = producer.produceBuildingBlockStore();

        assertThrows(UnsupportedOperationException.class,
                () -> noOpStore.getBuildingBlocksForNamespace("finos"));
    }

    @Test
    void no_op_store_throws_on_create_building_block_for_namespace() {
        producer.databaseMode = DatabaseMode.MONGO;
        BuildingBlockStore noOpStore = producer.produceBuildingBlockStore();

        assertThrows(UnsupportedOperationException.class,
                () -> noOpStore.createBuildingBlockForNamespace("finos", "{}"));
    }

    @Test
    void no_op_store_throws_on_get_building_block_versions() {
        producer.databaseMode = DatabaseMode.MONGO;
        BuildingBlockStore noOpStore = producer.produceBuildingBlockStore();

        assertThrows(UnsupportedOperationException.class,
                () -> noOpStore.getBuildingBlockVersions("finos", 1));
    }

    @Test
    void no_op_store_throws_on_get_building_block_for_version() {
        producer.databaseMode = DatabaseMode.MONGO;
        BuildingBlockStore noOpStore = producer.produceBuildingBlockStore();

        assertThrows(UnsupportedOperationException.class,
                () -> noOpStore.getBuildingBlockForVersion("finos", 1, "1.0.0"));
    }

    @Test
    void no_op_store_throws_on_create_building_block_for_version() {
        producer.databaseMode = DatabaseMode.MONGO;
        BuildingBlockStore noOpStore = producer.produceBuildingBlockStore();

        assertThrows(UnsupportedOperationException.class,
                () -> noOpStore.createBuildingBlockForVersion("finos", 1, "1.0.0", "{}"));
    }
}
