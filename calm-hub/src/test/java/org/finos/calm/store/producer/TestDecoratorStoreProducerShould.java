package org.finos.calm.store.producer;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.mongo.MongoDecoratorStore;
import org.finos.calm.store.nitrite.NitriteDecoratorStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@QuarkusTest
public class TestDecoratorStoreProducerShould {

    @InjectMock
    MongoDecoratorStore mongoDecoratorStore;

    @InjectMock
    NitriteDecoratorStore nitriteDecoratorStore;

    private DecoratorStoreProducer decoratorStoreProducer;

    @BeforeEach
    void setup() {
        decoratorStoreProducer = new DecoratorStoreProducer();
        decoratorStoreProducer.mongoDecoratorStore = mongoDecoratorStore;
        decoratorStoreProducer.nitriteDecoratorStore = nitriteDecoratorStore;
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
        // Given
        decoratorStoreProducer.databaseMode = "unknown";

        // When
        DecoratorStore result = decoratorStoreProducer.produceDecoratorStore();

        // Then
        assertThat(result, is(sameInstance(mongoDecoratorStore)));
    }
}
