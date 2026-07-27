package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.UpdateResult;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.BsonString;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
class TestMongoSchemaVersionStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    private MongoCollection<Document> calmCollection;
    private MongoSchemaVersionStore store;

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    @BeforeEach
    void setup() {
        calmCollection = Mockito.mock(DocumentMongoCollection.class);
        when(mongoDatabase.getCollection("calm")).thenReturn(calmCollection);
        store = new MongoSchemaVersionStore(mongoDatabase);
    }

    @Test
    void return_zero_when_no_schema_version_document_exists() {
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(calmCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(store.getSchemaVersion(), is(0));
    }

    @Test
    void return_the_stored_version_when_a_schema_version_document_exists() {
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(calmCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(new Document("_id", "schemaVersion").append("version", 3));

        assertThat(store.getSchemaVersion(), is(3));
    }

    @Test
    void upsert_the_schema_version_document_on_set() {
        when(calmCollection.updateOne(ArgumentMatchers.any(Bson.class), ArgumentMatchers.any(Bson.class),
                ArgumentMatchers.any(UpdateOptions.class))).thenReturn(mock(UpdateResult.class));

        store.setSchemaVersion(2);

        verify(calmCollection).updateOne(
                ArgumentMatchers.<Bson>argThat(filter -> filter.toBsonDocument().get("_id").asString().getValue().equals("schemaVersion")),
                ArgumentMatchers.<Bson>argThat(update -> update.toBsonDocument().getDocument("$set").getInt32("version").getValue() == 2),
                ArgumentMatchers.argThat(UpdateOptions::isUpsert));
    }

    @Test
    void acquire_the_lock_when_no_lock_document_exists() {
        UpdateResult result = mock(UpdateResult.class);
        when(result.getModifiedCount()).thenReturn(0L);
        when(result.getUpsertedId()).thenReturn(new BsonString("upserted"));
        when(calmCollection.updateOne(ArgumentMatchers.any(Bson.class), ArgumentMatchers.any(Bson.class),
                ArgumentMatchers.any(UpdateOptions.class))).thenReturn(result);

        assertThat(store.acquireMigrationLock("instance-a"), is(true));
    }

    @Test
    void not_acquire_the_lock_when_another_instance_already_holds_it() {
        UpdateResult result = mock(UpdateResult.class);
        when(result.getModifiedCount()).thenReturn(0L);
        when(result.getUpsertedId()).thenReturn(null);
        when(calmCollection.updateOne(ArgumentMatchers.any(Bson.class), ArgumentMatchers.any(Bson.class),
                ArgumentMatchers.any(UpdateOptions.class))).thenReturn(result);

        assertThat(store.acquireMigrationLock("instance-a"), is(false));
    }

    @Test
    void retry_once_after_losing_the_race_to_create_the_lock_document() {
        MongoWriteException duplicateKey = new MongoWriteException(
                new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of());
        UpdateResult retryResult = mock(UpdateResult.class);
        when(retryResult.getModifiedCount()).thenReturn(0L);
        when(retryResult.getUpsertedId()).thenReturn(null);
        when(calmCollection.updateOne(ArgumentMatchers.any(Bson.class), ArgumentMatchers.any(Bson.class),
                ArgumentMatchers.any(UpdateOptions.class)))
                .thenThrow(duplicateKey)
                .thenReturn(retryResult);

        assertThat(store.acquireMigrationLock("instance-a"), is(false));
    }

    @Test
    void rethrow_non_duplicate_key_write_exceptions_when_acquiring_the_lock() {
        MongoWriteException other = new MongoWriteException(
                new WriteError(2, "some other error", new BsonDocument()), new ServerAddress(), List.of());
        when(calmCollection.updateOne(ArgumentMatchers.any(Bson.class), ArgumentMatchers.any(Bson.class),
                ArgumentMatchers.any(UpdateOptions.class))).thenThrow(other);

        org.junit.jupiter.api.Assertions.assertThrows(MongoWriteException.class,
                () -> store.acquireMigrationLock("instance-a"));
    }

    @Test
    void release_the_lock_conditioned_on_the_given_instance_being_the_holder() {
        store.releaseMigrationLock("instance-a");

        verify(calmCollection).updateOne(
                ArgumentMatchers.<Bson>argThat(filter -> {
                    BsonDocument and = filter.toBsonDocument().getArray("$and").get(1).asDocument();
                    return "instance-a".equals(and.getString("holder").getValue());
                }),
                ArgumentMatchers.<Bson>argThat(update -> update.toBsonDocument().getDocument("$unset").containsKey("holder")));
    }

    @Test
    void report_the_lock_as_not_held_when_no_lock_document_exists() {
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(calmCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(store.isMigrationLockHeld(), is(false));
    }

    @Test
    void report_the_lock_as_not_held_when_the_lock_document_has_no_holder() {
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(calmCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(new Document("_id", "migrationLock"));

        assertThat(store.isMigrationLockHeld(), is(false));
    }

    @Test
    void report_the_lock_as_held_when_the_lock_document_has_a_holder() {
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(calmCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(new Document("_id", "migrationLock").append("holder", "instance-a"));

        assertThat(store.isMigrationLockHeld(), is(true));
    }
}
