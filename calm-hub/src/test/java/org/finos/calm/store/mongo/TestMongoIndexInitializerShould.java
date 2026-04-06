package org.finos.calm.store.mongo;

import com.mongodb.client.MongoDatabase;
import io.quarkus.runtime.StartupEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestMongoIndexInitializerShould {

    @Test
    void skip_index_creation_when_database_mode_is_not_mongo() throws Exception {
        MongoDatabase mockDatabase = mock(MongoDatabase.class);
        MongoIndexInitializer initializer = new MongoIndexInitializer(mockDatabase);
        setDatabaseMode(initializer, "nitrite");

        initializer.onStart(mock(StartupEvent.class));

        verifyNoInteractions(mockDatabase);
    }

    @Test
    void handle_exception_during_index_creation_gracefully() throws Exception {
        MongoDatabase mockDatabase = mock(MongoDatabase.class);
        when(mockDatabase.getCollection(anyString())).thenThrow(new RuntimeException("MongoDB unavailable"));
        MongoIndexInitializer initializer = new MongoIndexInitializer(mockDatabase);
        setDatabaseMode(initializer, "mongo");

        initializer.onStart(mock(StartupEvent.class));

        verify(mockDatabase).getCollection("namespaces");
    }

    private void setDatabaseMode(MongoIndexInitializer initializer, String mode) throws Exception {
        Field field = MongoIndexInitializer.class.getDeclaredField("databaseMode");
        field.setAccessible(true);
        field.set(initializer, mode);
    }
}
