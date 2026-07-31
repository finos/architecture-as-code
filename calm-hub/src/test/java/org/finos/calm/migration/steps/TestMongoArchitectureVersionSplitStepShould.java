package org.finos.calm.migration.steps;

import com.mongodb.MongoCommandException;
import com.mongodb.ServerAddress;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
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

import java.util.List;
import java.util.function.Consumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoArchitectureVersionSplitStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoDatabase database;
    private MongoCollection<Document> headers;
    private MongoCollection<Document> versions;
    private MongoArchitectureVersionSplitStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        headers = mock(DocumentMongoCollection.class);
        versions = mock(DocumentMongoCollection.class);
        when(database.getCollection("architectures")).thenReturn(headers);
        when(database.getCollection("architectureVersions")).thenReturn(versions);

        step = new MongoArchitectureVersionSplitStep(database);
        step.databaseMode = "mongo";
        stubOldDocuments(List.of());
    }

    private void stubOldDocuments(List<Document> documents) {
        FindIterable<Document> iterable = mock(DocumentFindIterable.class);
        when(headers.find(any(Bson.class))).thenReturn(iterable);
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            documents.forEach(consumer);
            return null;
        }).when(iterable).forEach(any());
    }

    /** One old-shape namespace document holding one architecture with two versions. */
    private static Document oldNamespaceDocument() {
        return new Document("_id", "abc")
                .append("namespace", "finos")
                .append("architectures", List.of(new Document("architectureId", 1)
                        .append("name", "Sample")
                        .append("description", "A description")
                        .append("versions", new Document("1-0-0", new Document("nodes", List.of()))
                                .append("1-1-0", new Document("nodes", List.of())))));
    }

    private static MongoCommandException commandException(int code, String message) {
        BsonDocument response = new BsonDocument("ok", new BsonInt32(0))
                .append("code", new BsonInt32(code))
                .append("errmsg", new BsonString(message));
        return new MongoCommandException(response, new ServerAddress());
    }

    @Test
    void run_at_schema_version_two() {
        assertThat(step.fromVersion(), is(2));
    }

    // --- index transition ---

    @Test
    void drop_the_one_document_per_namespace_index_before_creating_the_new_ones() {
        step.apply();

        // The old unique index on namespace alone enforces the shape being migrated away
        // from, so headers for two architectures in one namespace cannot exist until it
        // is gone. MongoIndexInitializationStep is immutable, so the drop lives here.
        verify(headers).dropIndex("namespace_1");
        verify(headers).createIndex(eq(new Document("namespace", 1).append("architectureId", 1)), any());
        verify(versions).createIndex(
                eq(new Document("namespace", 1).append("architectureId", 1).append("version", 1)), any());
    }

    @Test
    void tolerate_the_old_index_already_being_absent() {
        doThrow(commandException(27, "index not found with name [namespace_1]"))
                .when(headers).dropIndex(anyString());

        // A retried step, or a deployment that never had the index, must still proceed.
        assertDoesNotThrow(() -> step.apply());
        verify(headers).createIndex(eq(new Document("namespace", 1).append("architectureId", 1)), any());
    }

    @Test
    void propagate_index_drop_failures_that_are_not_a_missing_index() {
        doThrow(commandException(13, "not authorized")).when(headers).dropIndex(anyString());

        // Swallowing this would leave the old constraint in place and the fan-out failing
        // on every insert, with nothing to say why.
        assertThrows(MongoCommandException.class, () -> step.apply());
    }

    // --- fan-out ---

    @Test
    void write_one_header_per_architecture_with_a_counted_version_total() {
        stubOldDocuments(List.of(oldNamespaceDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headers).replaceOne(any(Bson.class), captor.capture(), any(ReplaceOptions.class));
        Document header = captor.getValue();
        assertThat(header.getString("namespace"), is("finos"));
        assertThat(header.getInteger("architectureId"), is(1));
        assertThat(header.getString("name"), is("Sample"));
        assertThat(header.getInteger("versionCount"), is(2));
        assertThat(header.get("metadata", Document.class), is(new Document()));
    }

    @Test
    void write_one_version_document_per_stored_version_with_dot_separated_keys() {
        stubOldDocuments(List.of(oldNamespaceDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versions, org.mockito.Mockito.times(2))
                .replaceOne(any(Bson.class), captor.capture(), any(ReplaceOptions.class));
        // Dash-encoded keys existed only because Mongo field names can't contain a dot.
        // Now the version is a field value, so it converts to the spelling the store reads.
        assertThat(captor.getAllValues().stream().map(d -> d.getString("version")).toList(),
                contains("1.0.0", "1.1.0"));
        assertThat(captor.getAllValues().get(0).get("content", Document.class),
                is(new Document("nodes", List.of())));
    }

    @Test
    void delete_the_old_namespace_document_only_after_rewriting_its_contents() {
        stubOldDocuments(List.of(oldNamespaceDocument()));

        step.apply();

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(headers, versions);
        order.verify(headers).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        order.verify(versions, org.mockito.Mockito.atLeastOnce())
                .replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        // A crash before this point leaves the source intact and the namespace is redone.
        order.verify(headers).deleteOne(any(Bson.class));
    }

    @Test
    void write_a_header_but_no_versions_for_an_architecture_that_has_none() {
        stubOldDocuments(List.of(new Document("_id", "abc")
                .append("namespace", "finos")
                .append("architectures", List.of(new Document("architectureId", 9).append("name", "Empty")))));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headers).replaceOne(any(Bson.class), captor.capture(), any(ReplaceOptions.class));
        assertThat(captor.getValue().getInteger("versionCount"), is(0));
        verify(versions, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    @Test
    void do_nothing_to_a_collection_that_holds_only_headers() {
        // Headers carry no architectures array, so the selection finds nothing — this is
        // what makes a re-run a no-op rather than a duplicate-key failure.
        stubOldDocuments(List.of());

        step.apply();

        verify(headers, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        verify(headers, never()).deleteOne(any(Bson.class));
    }

    @Test
    void skip_the_whole_step_when_not_running_against_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verify(headers, never()).dropIndex(anyString());
        verify(headers, never()).createIndex(any(Bson.class), any());
    }
}
