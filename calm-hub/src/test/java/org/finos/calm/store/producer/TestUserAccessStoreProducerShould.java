package org.finos.calm.store.producer;

import org.finos.calm.store.UserAccessStore;
import org.finos.calm.store.mongo.MongoUserAccessStore;
import org.finos.calm.store.nitrite.NitriteUserAccessStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.sameInstance;

@ExtendWith(MockitoExtension.class)
public class TestUserAccessStoreProducerShould {

    @Mock
    private MongoUserAccessStore mockMongoUserAccessStore;

    @Mock
    private NitriteUserAccessStore mockNitriteUserAccessStore;

    private UserAccessStoreProducer producer;

    @BeforeEach
    public void setup() throws Exception {
        producer = new UserAccessStoreProducer();
        
        // Use reflection to inject the mocked dependencies
        Field mongoField = UserAccessStoreProducer.class.getDeclaredField("mongoUserAccessStore");
        mongoField.setAccessible(true);
        mongoField.set(producer, mockMongoUserAccessStore);
        
        Field nitriteField = UserAccessStoreProducer.class.getDeclaredField("standaloneUserAccessStore");
        nitriteField.setAccessible(true);
        nitriteField.set(producer, mockNitriteUserAccessStore);
    }

    @Test
    public void testProduceUserAccessStore_whenDatabaseModeIsStandalone_returnsNitriteStore() throws Exception {
        // Arrange
        Field databaseModeField = UserAccessStoreProducer.class.getDeclaredField("databaseMode");
        databaseModeField.setAccessible(true);
        databaseModeField.set(producer, "standalone");

        // Act
        UserAccessStore result = producer.produceUserAccessStore();

        // Assert
        assertThat(result, is(sameInstance(mockNitriteUserAccessStore)));
    }

    @Test
    public void testProduceUserAccessStore_whenDatabaseModeIsMongo_returnsMongoStore() throws Exception {
        // Arrange
        Field databaseModeField = UserAccessStoreProducer.class.getDeclaredField("databaseMode");
        databaseModeField.setAccessible(true);
        databaseModeField.set(producer, "mongo");

        // Act
        UserAccessStore result = producer.produceUserAccessStore();

        // Assert
        assertThat(result, is(sameInstance(mockMongoUserAccessStore)));
    }

    @Test
    public void testProduceUserAccessStore_whenDatabaseModeIsNull_returnsMongoStore() throws Exception {
        // Arrange
        Field databaseModeField = UserAccessStoreProducer.class.getDeclaredField("databaseMode");
        databaseModeField.setAccessible(true);
        databaseModeField.set(producer, null);

        // Act
        UserAccessStore result = producer.produceUserAccessStore();

        // Assert
        assertThat(result, is(sameInstance(mockMongoUserAccessStore)));
    }

    @Test
    public void testProduceUserAccessStore_whenDatabaseModeIsUnknown_returnsMongoStore() throws Exception {
        // Arrange
        Field databaseModeField = UserAccessStoreProducer.class.getDeclaredField("databaseMode");
        databaseModeField.setAccessible(true);
        databaseModeField.set(producer, "unknown");

        // Act
        UserAccessStore result = producer.produceUserAccessStore();

        // Assert
        assertThat(result, is(sameInstance(mockMongoUserAccessStore)));
    }
}
