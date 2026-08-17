package org.finos.calm.store.producer;

import org.finos.calm.config.DatabaseMode;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.github.GitHubDecoratorStore;
import org.finos.calm.store.mongo.MongoDecoratorStore;
import org.finos.calm.store.nitrite.NitriteDecoratorStore;
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
public class TestDecoratorStoreProducerShould {

    @Mock
    MongoDecoratorStore mongoDecoratorStore;

    @Mock
    Instance<MongoDecoratorStore> mongoDecoratorStoreInstance;

    @Mock
    NitriteDecoratorStore nitriteDecoratorStore;

    @Mock
    Instance<NitriteDecoratorStore> nitriteDecoratorStoreInstance;

    @Mock
    GitHubDecoratorStore gitHubDecoratorStore;

    @Mock
    Instance<GitHubDecoratorStore> gitHubDecoratorStoreInstance;

    private DecoratorStoreProducer decoratorStoreProducer;

    @BeforeEach
    void setup() {
        decoratorStoreProducer = new DecoratorStoreProducer();
        when(mongoDecoratorStoreInstance.get()).thenReturn(mongoDecoratorStore);
        decoratorStoreProducer.mongoDecoratorStore = mongoDecoratorStoreInstance;
        when(nitriteDecoratorStoreInstance.get()).thenReturn(nitriteDecoratorStore);
        decoratorStoreProducer.standaloneDecoratorStore = nitriteDecoratorStoreInstance;
        when(gitHubDecoratorStoreInstance.get()).thenReturn(gitHubDecoratorStore);
        decoratorStoreProducer.gitHubDecoratorStore = gitHubDecoratorStoreInstance;
    }

    @Test
    void return_mongo_decorator_store_when_database_mode_is_mongo() {
        // Given
        decoratorStoreProducer.databaseMode = "mongo";

        // When
        DecoratorStore result = decoratorStoreProducer.produceDecoratorStore();

        // Then
        assertThat(result, is(sameInstance(mongoDecoratorStore)));
    }

    @Test
    void return_nitrite_decorator_store_when_database_mode_is_standalone() {
        // Given
        decoratorStoreProducer.databaseMode = "standalone";

        // When
        DecoratorStore result = decoratorStoreProducer.produceDecoratorStore();

        // Then
        assertThat(result, is(sameInstance(nitriteDecoratorStore)));
    }

    @Test
    void return_mongo_decorator_store_when_database_mode_is_not_recognized() {
        decoratorStoreProducer.databaseMode = "unknown";

        DecoratorStore result = decoratorStoreProducer.produceDecoratorStore();

        assertThat(result, is(sameInstance(mongoDecoratorStore)));
    }

    @Test
    void return_github_decorator_store_when_database_mode_is_github() {
        decoratorStoreProducer.databaseMode = DatabaseMode.GITHUB;

        DecoratorStore result = decoratorStoreProducer.produceDecoratorStore();

        assertThat(result, is(sameInstance(gitHubDecoratorStore)));
    }
}
