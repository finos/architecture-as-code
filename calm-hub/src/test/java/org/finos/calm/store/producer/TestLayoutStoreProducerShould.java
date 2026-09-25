package org.finos.calm.store.producer;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.LayoutStore;
import org.finos.calm.store.github.GitHubLayoutStore;
import org.finos.calm.store.mongo.MongoLayoutStore;
import org.finos.calm.store.nitrite.NitriteLayoutStore;
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
public class TestLayoutStoreProducerShould {

    @Mock
    MongoLayoutStore mongoLayoutStore;

    @Mock
    Instance<MongoLayoutStore> mongoLayoutStoreInstance;

    @Mock
    NitriteLayoutStore nitriteLayoutStore;

    @Mock
    Instance<NitriteLayoutStore> nitriteLayoutStoreInstance;

    @Mock
    GitHubLayoutStore gitHubLayoutStore;

    @Mock
    Instance<GitHubLayoutStore> gitHubLayoutStoreInstance;

    private LayoutStoreProducer layoutStoreProducer;

    @BeforeEach
    void setup() {
        layoutStoreProducer = new LayoutStoreProducer();
        when(mongoLayoutStoreInstance.get()).thenReturn(mongoLayoutStore);
        layoutStoreProducer.mongoLayoutStore = mongoLayoutStoreInstance;
        when(nitriteLayoutStoreInstance.get()).thenReturn(nitriteLayoutStore);
        layoutStoreProducer.standaloneLayoutStore = nitriteLayoutStoreInstance;
        when(gitHubLayoutStoreInstance.get()).thenReturn(gitHubLayoutStore);
        layoutStoreProducer.gitHubLayoutStore = gitHubLayoutStoreInstance;
    }

    @Test
    void return_mongo_layout_store_when_database_mode_is_mongo() {
        // Given
        layoutStoreProducer.databaseMode = "mongo";

        // When
        LayoutStore result = layoutStoreProducer.produceLayoutStore();

        // Then
        assertThat(result, is(sameInstance(mongoLayoutStore)));
    }

    @Test
    void return_nitrite_layout_store_when_database_mode_is_standalone() {
        // Given
        layoutStoreProducer.databaseMode = "standalone";

        // When
        LayoutStore result = layoutStoreProducer.produceLayoutStore();

        // Then
        assertThat(result, is(sameInstance(nitriteLayoutStore)));
    }

    @Test
    void return_mongo_layout_store_when_database_mode_is_not_recognized() {
        layoutStoreProducer.databaseMode = "unknown";

        LayoutStore result = layoutStoreProducer.produceLayoutStore();

        assertThat(result, is(sameInstance(mongoLayoutStore)));
    }

    @Test
    void return_github_layout_store_when_database_mode_is_github() {
        layoutStoreProducer.databaseMode = DatabaseMode.GITHUB;

        LayoutStore result = layoutStoreProducer.produceLayoutStore();

        assertThat(result, is(sameInstance(gitHubLayoutStore)));
    }
}
