package org.finos.calm.migration.steps;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.ReplaceOptions;
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
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pattern-specific wiring only. The fan-out itself is {@link MongoVersionSplitMigration},
 * exercised in depth by {@code TestMongoArchitectureVersionSplitStepShould} — repeating
 * those cases here would test the same code twice under a different name. What matters for
 * this class is that it targets the right collections, at the right schema version, and
 * still honours the database-mode gate.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoPatternVersionSplitStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoCollection<Document> headers;
    private MongoCollection<Document> versions;
    private MongoPatternVersionSplitStep step;

    @BeforeEach
    void setup() {
        MongoDatabase database = mock(MongoDatabase.class);
        headers = mock(DocumentMongoCollection.class);
        versions = mock(DocumentMongoCollection.class);
        when(database.getCollection("patterns")).thenReturn(headers);
        when(database.getCollection("patternVersions")).thenReturn(versions);

        step = new MongoPatternVersionSplitStep(database);
        step.databaseMode = "mongo";
        stubOldDocuments(List.of());
    }

    private void stubOldDocuments(List<Document> documents) {
        when(headers.find(any(Bson.class))).thenAnswer(invocation -> {
            String filter = ((Bson) invocation.getArgument(0)).toBsonDocument().toJson();
            FindIterable<Document> iterable = mock(DocumentFindIterable.class);
            when(iterable.projection(any())).thenReturn(iterable);
            if (filter.contains("patterns")) {
                doAnswer(scan -> {
                    Consumer<Document> consumer = scan.getArgument(0);
                    documents.forEach(consumer);
                    return null;
                }).when(iterable).forEach(any());
                return iterable;
            }
            when(iterable.first()).thenReturn(documents.isEmpty() ? null : documents.get(0));
            return iterable;
        });
    }

    @Test
    void run_at_schema_version_three() {
        // One past Architecture's. A new step rather than an edit to that one, because a
        // committed step is immutable — a deployment already past 3 never re-runs it.
        assertThat(step.fromVersion(), is(3));
    }

    @Test
    void swap_the_pattern_indexes_rather_than_the_architecture_ones() {
        step.apply();

        verify(headers).dropIndex("namespace_1");
        verify(headers).createIndex(eq(new Document("namespace", 1).append("patternId", 1)), any());
        verify(versions).createIndex(
                eq(new Document("namespace", 1).append("patternId", 1).append("version", 1)), any());
    }

    @Test
    void fan_a_namespace_document_out_into_pattern_headers_and_versions() {
        stubOldDocuments(List.of(new Document("_id", "abc")
                .append("namespace", "finos")
                .append("patterns", List.of(new Document("patternId", 1)
                        .append("name", "Sample")
                        .append("description", "A description")
                        .append("versions", new Document("1-0-0", new Document("nodes", List.of())))))));

        step.apply();

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headers).replaceOne(any(Bson.class), headerCaptor.capture(), any(ReplaceOptions.class));
        assertThat(headerCaptor.getValue().getInteger("patternId"), is(1));
        assertThat(headerCaptor.getValue().getInteger("versionCount"), is(1));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versions).replaceOne(any(Bson.class), versionCaptor.capture(), any(ReplaceOptions.class));
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.0"));

        verify(headers).deleteOne(any(Bson.class));
    }

    @Test
    void skip_the_whole_step_when_not_running_against_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verify(headers, never()).dropIndex(anyString());
        verify(headers, never()).createIndex(any(Bson.class), any());
    }

    @Test
    void transition_indexes_without_fanning_anything_out() {
        // The entry point integration-test infrastructure uses to bring a database's
        // indexes to the new shape when it has no old-shape data to migrate.
        step.transitionIndexes();

        verify(headers).createIndex(eq(new Document("namespace", 1).append("patternId", 1)), any());
        verify(headers, never()).deleteOne(any(Bson.class));
    }
}
