package org.finos.calm.migration.steps;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;

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
        MongoIndexInitializationStep initializer = new MongoIndexInitializationStep(mock(MongoDatabase.class));

        assertThat(initializer.fromVersion(), is(0));
    }

    @Test
    void skip_index_creation_when_database_mode_is_not_mongo() throws Exception {
        MongoDatabase mockDatabase = mock(MongoDatabase.class);
        MongoIndexInitializationStep initializer = new MongoIndexInitializationStep(mockDatabase);
        setDatabaseMode(initializer, "nitrite");

        initializer.apply();

        verifyNoInteractions(mockDatabase);
    }

    @Test
    void create_all_unique_indexes_when_database_mode_is_mongo() throws Exception {
        MongoDatabase mockDatabase = mock(MongoDatabase.class);
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
        // layouts is a flat one-document-per-(namespace, architectureId) collection, not one
        // document per namespace holding an array — its index is created by
        // MongoLayoutIndexStep instead, not here.
        verify(mockDatabase, never()).getCollection("layouts");
        // Domain-scoped + resource mappings
        verify(mockDatabase).getCollection("controls");
        verify(mockDatabase, times(2)).getCollection("resource_mappings");
        // userAccess partial unique indexes
        verify(mockDatabase, times(2)).getCollection("userAccess");
    }

    @Test
    void propagate_index_creation_failures_instead_of_swallowing_them() throws Exception {
        // A swallowed failure here would let SchemaMigrationRunner mark the version-0-to-1
        // migration successful with indexes that were never actually created — and since this
        // step only ever runs once, that gap would be permanent and silent. Letting the
        // exception propagate is what makes the runner retry this step on the next startup
        // instead.
        MongoDatabase mockDatabase = mock(MongoDatabase.class);
        RuntimeException unavailable = new RuntimeException("MongoDB unavailable");
        when(mockDatabase.getCollection(anyString())).thenThrow(unavailable);
        MongoIndexInitializationStep initializer = new MongoIndexInitializationStep(mockDatabase);
        setDatabaseMode(initializer, "mongo");

        RuntimeException thrown = org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, initializer::apply);

        assertThat(thrown, is(unavailable));
        verify(mockDatabase).getCollection("namespaces");
    }

    @Test
    void create_indexes_directly_without_needing_the_database_mode_configured() {
        // createIndexes() is the entry point integration-test infrastructure (EndToEndResource)
        // calls directly against a real, known-Mongo container — it must not depend on the
        // CDI-injected databaseMode field, which is never set outside a running application.
        MongoDatabase mockDatabase = mock(MongoDatabase.class);
        MongoCollection<Document> mockCollection = mock(DocumentMongoCollection.class);
        when(mockDatabase.getCollection(anyString())).thenReturn(mockCollection);
        when(mockCollection.createIndex(any(Document.class), any(IndexOptions.class))).thenReturn("idx");
        when(mockCollection.createIndex(any(Document.class))).thenReturn("idx");

        MongoIndexInitializationStep initializer = new MongoIndexInitializationStep(mockDatabase);

        initializer.createIndexes();

        verify(mockDatabase).getCollection("namespaces");
        verify(mockDatabase, times(4)).getCollection("auditLogs");
    }

    private void setDatabaseMode(MongoIndexInitializationStep initializer, String mode) throws Exception {
        Field field = MongoIndexInitializationStep.class.getDeclaredField("databaseMode");
        field.setAccessible(true);
        field.set(initializer, mode);
    }
}
