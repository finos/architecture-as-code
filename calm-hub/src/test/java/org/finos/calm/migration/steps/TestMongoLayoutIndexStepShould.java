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
class TestMongoLayoutIndexStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private MongoDatabase database;
    private MongoCollection<Document> layouts;
    private MongoLayoutIndexStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        layouts = mock(DocumentMongoCollection.class);
        when(database.getCollection("layouts")).thenReturn(layouts);

        step = new MongoLayoutIndexStep(database);
        step.databaseMode = "mongo";
    }

    private static MongoCommandException commandException(int code, String message) {
        BsonDocument response = new BsonDocument("ok", new BsonInt32(0))
                .append("code", new BsonInt32(code))
                .append("errmsg", new BsonString(message));
        return new MongoCommandException(response, new ServerAddress());
    }

    @Test
    void run_at_schema_version_nine() {
        assertThat(step.fromVersion(), is(9));
    }

    @Test
    void skip_index_creation_when_database_mode_is_not_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verifyNoInteractions(database);
    }

    @Test
    void create_the_compound_unique_index_on_layouts() {
        step.apply();

        verify(layouts).createIndex(eq(new Document("namespace", 1).append("architectureId", 1)), any());
    }

    @Test
    void drop_the_stale_namespace_only_index_before_creating_the_compound_one() {
        step.apply();

        // An unshipped revision of MongoIndexInitializationStep briefly created this index —
        // wrong for the flat shape, since {namespace: 1} unique would allow only one layout
        // document per namespace. Only developer databases that ran that revision could hold
        // it, but the drop has to run unconditionally to reach them.
        verify(layouts).dropIndex("namespace_1");
    }

    @Test
    void tolerate_the_stale_index_being_absent() {
        doThrow(commandException(27, "index not found with name [namespace_1]"))
                .when(layouts).dropIndex(anyString());

        assertDoesNotThrow(() -> step.apply());
        verify(layouts).createIndex(eq(new Document("namespace", 1).append("architectureId", 1)), any());
    }

    @Test
    void propagate_index_drop_failures_that_are_not_a_missing_index() {
        doThrow(commandException(13, "not authorized")).when(layouts).dropIndex(anyString());

        assertThrows(MongoCommandException.class, () -> step.apply());
    }

    @Test
    void create_indexes_directly_without_needing_the_database_mode_configured() {
        // createIndexes() is the entry point integration-test infrastructure (EndToEndResource)
        // calls directly against a real, known-Mongo container — it must not depend on the
        // CDI-injected databaseMode field, which is never set outside a running application.
        MongoLayoutIndexStep unconfigured = new MongoLayoutIndexStep(database);

        unconfigured.createIndexes();

        verify(layouts).createIndex(eq(new Document("namespace", 1).append("architectureId", 1)), any());
    }
}
