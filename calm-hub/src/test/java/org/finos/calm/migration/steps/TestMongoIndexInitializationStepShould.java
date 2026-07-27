package org.finos.calm.migration.steps;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestMongoIndexInitializationStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {}

    @Test
    void report_zero_as_its_from_version() {
        MongoIndexInitializationStep initializer = new MongoIndexInitializationStep(mock(MongoDatabase.class, org.mockito.Answers.RETURNS_SELF));

        assertThat(initializer.fromVersion(), is(0));
    }

    @Test
    void run_in_test_mode() {
        MongoIndexInitializationStep initializer = new MongoIndexInitializationStep(mock(MongoDatabase.class, org.mockito.Answers.RETURNS_SELF));

        assertThat(initializer.runInTestMode(), is(true));
    }

    @Test
    void scope_every_operation_to_a_short_client_side_timeout() {
        MongoDatabase mockDatabase = mock(MongoDatabase.class, org.mockito.Answers.RETURNS_SELF);

        new MongoIndexInitializationStep(mockDatabase);

        verify(mockDatabase).withTimeout(3, TimeUnit.SECONDS);
    }

    @Test
    void skip_index_creation_when_database_mode_is_not_mongo() throws Exception {
        // Not verifyNoInteractions: the constructor always calls withTimeout(...) regardless
        // of mode, so the assertion here is specifically "no index-related calls happen".
        MongoDatabase mockDatabase = mock(MongoDatabase.class, org.mockito.Answers.RETURNS_SELF);
        MongoIndexInitializationStep initializer = new MongoIndexInitializationStep(mockDatabase);
        setDatabaseMode(initializer, "nitrite");

        initializer.apply();

        verify(mockDatabase, never()).getCollection(anyString());
    }

    @Test
    void create_all_unique_indexes_when_database_mode_is_mongo() throws Exception {
        MongoDatabase mockDatabase = mock(MongoDatabase.class, org.mockito.Answers.RETURNS_SELF);
        MongoCollection<Document> mockCollection = mock(DocumentMongoCollection.class);
        when(mockDatabase.getCollection(anyString())).thenReturn(mockCollection);
        when(mockCollection.createIndex(any(Document.class), any(IndexOptions.class))).thenReturn("idx");
        when(mockCollection.createIndex(any(Document.class))).thenReturn("idx");

        MongoIndexInitializationStep initializer = new MongoIndexInitializationStep(mockDatabase);
        setDatabaseMode(initializer, "mongo");

        initializer.apply();

        // Top-level collections: namespaces, domains, schemas
        verify(mockDatabase).getCollection("namespaces");
        verify(mockDatabase).getCollection("domains");
        verify(mockDatabase).getCollection("schemas");
        // Namespace-scoped: architectures, patterns, flows, timelines, standards, interfaces, adrs, decorators
        verify(mockDatabase).getCollection("architectures");
        verify(mockDatabase).getCollection("patterns");
        verify(mockDatabase).getCollection("flows");
        verify(mockDatabase).getCollection("timelines");
        verify(mockDatabase).getCollection("standards");
        verify(mockDatabase).getCollection("interfaces");
        verify(mockDatabase).getCollection("adrs");
        verify(mockDatabase).getCollection("decorators");
        // Domain-scoped + resource mappings
        verify(mockDatabase).getCollection("controls");
        verify(mockDatabase, times(2)).getCollection("resource_mappings");
        // userAccess partial unique indexes
        verify(mockDatabase, times(2)).getCollection("userAccess");
    }

    @Test
    void handle_exception_during_index_creation_gracefully() throws Exception {
        MongoDatabase mockDatabase = mock(MongoDatabase.class, org.mockito.Answers.RETURNS_SELF);
        when(mockDatabase.getCollection(anyString())).thenThrow(new RuntimeException("MongoDB unavailable"));
        MongoIndexInitializationStep initializer = new MongoIndexInitializationStep(mockDatabase);
        setDatabaseMode(initializer, "mongo");

        initializer.apply();

        verify(mockDatabase).getCollection("namespaces");
    }

    private void setDatabaseMode(MongoIndexInitializationStep initializer, String mode) throws Exception {
        Field field = MongoIndexInitializationStep.class.getDeclaredField("databaseMode");
        field.setAccessible(true);
        field.set(initializer, mode);
    }
}
