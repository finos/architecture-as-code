package org.finos.calm.migration.steps;

import com.mongodb.MongoCommandException;
import com.mongodb.ServerAddress;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.BsonDocument;
import org.bson.BsonInt32;
import org.bson.BsonString;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoResourceMappingIndexStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private MongoDatabase database;
    private MongoCollection<Document> resourceMappings;
    private MongoResourceMappingIndexStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        resourceMappings = mock(DocumentMongoCollection.class);
        when(database.getCollection("resource_mappings")).thenReturn(resourceMappings);

        step = new MongoResourceMappingIndexStep(database);
        step.databaseMode = "mongo";
    }

    private static MongoCommandException commandException(int code, String message) {
        BsonDocument response = new BsonDocument("ok", new BsonInt32(0))
                .append("code", new BsonInt32(code))
                .append("errmsg", new BsonString(message));
        return new MongoCommandException(response, new ServerAddress());
    }

    @Test
    void run_at_schema_version_eleven() {
        assertThat(step.fromVersion(), is(11));
    }

    @Test
    void skip_index_creation_when_database_mode_is_not_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verifyNoInteractions(database);
    }

    @Test
    void create_the_compound_unique_index_on_resource_mappings() {
        step.apply();

        verify(resourceMappings).createIndex(
                eq(new Document("namespace", 1).append("resourceType", 1).append("customId", 1)), any());
    }

    @Test
    void drop_the_stale_namespace_custom_id_index_before_creating_the_compound_one() {
        step.apply();

        // The (namespace, customId) unique index MongoIndexInitializationStep created at schema
        // version 0 collides a pattern and an architecture sharing a customId (#2970) — it has
        // to go before the wider (namespace, resourceType, customId) index can take its place.
        verify(resourceMappings).dropIndex("namespace_1_customId_1");
    }

    @Test
    void tolerate_the_stale_index_being_absent() {
        doThrow(commandException(27, "index not found with name [namespace_1_customId_1]"))
                .when(resourceMappings).dropIndex(anyString());

        assertDoesNotThrow(() -> step.apply());
        verify(resourceMappings).createIndex(
                eq(new Document("namespace", 1).append("resourceType", 1).append("customId", 1)), any());
    }

    @Test
    void propagate_index_drop_failures_that_are_not_a_missing_index() {
        doThrow(commandException(13, "not authorized")).when(resourceMappings).dropIndex(anyString());

        assertThrows(MongoCommandException.class, () -> step.apply());
    }

    @Test
    void create_indexes_directly_without_needing_the_database_mode_configured() {
        // createIndexes() is the entry point integration-test infrastructure (EndToEndResource)
        // calls directly against a real, known-Mongo container — it must not depend on the
        // CDI-injected databaseMode field, which is never set outside a running application.
        MongoResourceMappingIndexStep unconfigured = new MongoResourceMappingIndexStep(database);

        unconfigured.createIndexes();

        verify(resourceMappings).createIndex(
                eq(new Document("namespace", 1).append("resourceType", 1).append("customId", 1)), any());
    }
}
