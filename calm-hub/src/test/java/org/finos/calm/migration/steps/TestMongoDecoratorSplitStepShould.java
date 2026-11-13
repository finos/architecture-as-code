package org.finos.calm.migration.steps;

import com.mongodb.MongoCommandException;
import com.mongodb.ServerAddress;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.ReplaceOptions;
import org.bson.BsonDocument;
import org.bson.BsonInt32;
import org.bson.BsonString;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collection;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoDecoratorSplitStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private static final String NAMESPACE = "finos";
    private static final String TARGET = "/calm/namespaces/finos/architectures/1/versions/1-0-0";

    private MongoCollection<Document> decorators;
    private MongoCollection<Document> unmigrated;
    private MongoDecoratorSplitStep step;

    @BeforeEach
    void setup() {
        MongoDatabase database = mock(MongoDatabase.class);
        decorators = mock(DocumentMongoCollection.class);
        unmigrated = mock(DocumentMongoCollection.class);
        when(database.getCollection("decorators")).thenReturn(decorators);
        when(database.getCollection("decoratorsUnmigrated")).thenReturn(unmigrated);

        step = new MongoDecoratorSplitStep(database);
        step.databaseMode = "mongo";
    }

    private static Document entry(Object id, String uniqueId) {
        return new Document("decoratorId", id).append("decorator",
                new Document("unique-id", uniqueId).append("type", "deployment").append("target", List.of(TARGET)));
    }

    /** One old-shape namespace document: the id scan returns it, and the lookup by _id finds it. */
    private void stubOldDocument(List<Document> entries) {
        Document old = new Document("_id", "old-1").append("namespace", NAMESPACE).append("decorators", entries);

        FindIterable<Document> idScan = mock(DocumentFindIterable.class);
        when(idScan.projection(any())).thenReturn(idScan);
        doAnswer(invocation -> {
            Collection<Document> target = invocation.getArgument(0);
            target.add(new Document("_id", "old-1"));
            return target;
        }).when(idScan).into(any());

        FindIterable<Document> byId = mock(DocumentFindIterable.class);
        when(byId.first()).thenReturn(old);

        when(decorators.find(any(Bson.class))).thenAnswer(invocation -> {
            BsonDocument filter = invocation.<Bson>getArgument(0).toBsonDocument();
            return filter.containsKey("_id") ? byId : idScan;
        });
    }

    private static MongoCommandException commandError(int code) {
        return new MongoCommandException(new BsonDocument("code", new BsonInt32(code))
                .append("errmsg", new BsonString("error")), new ServerAddress());
    }

    @Test
    void run_at_schema_version_sixteen() {
        assertThat(step.fromVersion(), is(16));
    }

    @Test
    void do_nothing_outside_mongo_mode() {
        step.databaseMode = "standalone";

        step.apply();

        verify(decorators, never()).dropIndex(anyString());
        verify(decorators, never()).find(any(Bson.class));
    }

    @Test
    void replace_the_namespace_index_with_the_per_decorator_indexes() {
        stubOldDocument(List.of());

        step.apply();

        verify(decorators).dropIndex("namespace_1");
        verify(decorators).createIndex(eq(new Document("namespace", 1).append("decoratorId", 1)), any(IndexOptions.class));
        verify(decorators).createIndex(new Document("namespace", 1).append("target", 1).append("type", 1));
    }

    @Test
    void continue_when_the_old_index_is_already_gone() {
        stubOldDocument(List.of());
        doThrow(commandError(27)).when(decorators).dropIndex("namespace_1");

        step.migrate();

        verify(decorators).createIndex(new Document("namespace", 1).append("target", 1).append("type", 1));
    }

    @Test
    void fail_on_any_other_index_error() {
        doThrow(commandError(13)).when(decorators).dropIndex("namespace_1");

        assertThrows(MongoCommandException.class, () -> step.migrate());
    }

    @Test
    void write_one_document_per_decorator_then_delete_the_old_document() {
        stubOldDocument(List.of(entry(1, "d-1"), entry(2, "d-2")));
        ArgumentCaptor<Document> written = ArgumentCaptor.forClass(Document.class);

        step.migrate();

        verify(decorators, times(2)).replaceOne(any(Bson.class), written.capture(), any(ReplaceOptions.class));
        Document first = written.getAllValues().getFirst();
        assertThat(first.getString("namespace"), is(NAMESPACE));
        assertThat(first.getInteger("decoratorId"), is(1));
        assertThat(first.getString("type"), is("deployment"));
        assertThat(first.get("target"), is(List.of(TARGET)));
        verify(decorators).deleteOne(any(Bson.class));
        verify(unmigrated, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    @Test
    void keep_entries_without_a_valid_id_or_content_in_the_unmigrated_collection() {
        Document noId = entry(null, "no-id");
        Document noContent = new Document("decoratorId", 4);
        stubOldDocument(List.of(entry(1, "d-1"), noId, noContent));
        ArgumentCaptor<Document> kept = ArgumentCaptor.forClass(Document.class);

        step.migrate();

        verify(decorators, times(1)).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        verify(unmigrated).replaceOne(any(Bson.class), kept.capture(), any(ReplaceOptions.class));
        assertThat(kept.getValue().getList("decorators", Document.class), is(List.of(noId, noContent)));
        verify(decorators).deleteOne(any(Bson.class));
    }

    @Test
    void stop_without_changing_data_when_a_namespace_has_duplicate_ids() {
        stubOldDocument(List.of(entry(1, "d-1"), entry(1, "d-1-copy")));

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> step.migrate());

        assertThat(e.getMessage(), containsString("more than one decorator with id 1"));
        verify(decorators, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        verify(decorators, never()).deleteOne(any(Bson.class));
    }

    @Test
    void skip_an_old_document_that_was_deleted_after_the_id_scan() {
        stubOldDocument(List.of());
        FindIterable<Document> gone = mock(DocumentFindIterable.class);
        FindIterable<Document> idScan = decorators.find(new Document());
        when(decorators.find(any(Bson.class))).thenAnswer(invocation ->
                invocation.<Bson>getArgument(0).toBsonDocument().containsKey("_id") ? gone : idScan);

        step.migrate();

        verify(decorators, never()).deleteOne(any(Bson.class));
    }
}
