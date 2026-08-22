package org.finos.calm.migration.steps;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.UpdateResult;
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
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * See {@code calm-hub/decisions/0006-denormalize-adr-title-onto-header.md}. Backfills the
 * title {@code MongoAdrStore} now denormalizes onto every write, for headers that predate
 * that change.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoAdrTitleBackfillStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoDatabase database;
    private MongoCollection<Document> headerCollection;
    private MongoCollection<Document> versionCollection;
    private MongoAdrTitleBackfillStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        headerCollection = mock(DocumentMongoCollection.class);
        versionCollection = mock(DocumentMongoCollection.class);
        when(database.getCollection("adrs")).thenReturn(headerCollection);
        when(database.getCollection("adrVersions")).thenReturn(versionCollection);

        step = new MongoAdrTitleBackfillStep(database);
        step.databaseMode = "mongo";
    }

    /** Every header the collection holds — the step filters untitled ones out itself. */
    private void stubHeaders(List<Document> headers) {
        FindIterable<Document> iterable = mock(DocumentFindIterable.class);
        when(headerCollection.find()).thenReturn(iterable);
        when(iterable.projection(any())).thenReturn(iterable);
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            headers.forEach(consumer);
            return null;
        }).when(iterable).forEach(any());
    }

    /** Revision documents as listVersions sees them, plus the content getVersion returns. */
    private void stubRevisions(List<String> revisions, Document latestContent) {
        FindIterable<Document> iterable = mock(DocumentFindIterable.class);
        when(versionCollection.find(any(Bson.class))).thenReturn(iterable);
        when(iterable.projection(any())).thenReturn(iterable);
        when(iterable.first()).thenReturn(latestContent == null ? null : new Document("content", latestContent));
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            revisions.forEach(revision -> consumer.accept(new Document("version", revision)));
            return null;
        }).when(iterable).forEach(any());
    }

    @Test
    void run_at_schema_version_ten() {
        assertThat(step.fromVersion(), is(10));
    }

    @Test
    void skip_the_backfill_when_database_mode_is_not_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verify(headerCollection, never()).find();
    }

    @Test
    void skip_a_header_that_already_has_a_title() {
        stubHeaders(List.of(new Document("namespace", "finos").append("adrId", 1).append("name", "Already Titled")));

        step.backfill();

        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void write_the_resolved_title_onto_an_untitled_header() throws Exception {
        stubHeaders(List.of(new Document("namespace", "finos").append("adrId", 1)));
        stubRevisions(List.of("1"), new Document("title", "Resolved Title"));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        step.backfill();

        ArgumentCaptor<Bson> updateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection).updateOne(any(Bson.class), updateCaptor.capture());
        assertThat(updateCaptor.getValue().toBsonDocument().toJson(), containsString("Resolved Title"));
    }

    @Test
    void write_the_resolved_title_onto_a_header_with_a_blank_title() throws Exception {
        // A header with name: "   " must be picked up the same as one with no name field at
        // all — "untitled" is null-or-blank everywhere else in this change, and a Mongo
        // query for "missing or null" alone would leave a blank title stuck forever.
        stubHeaders(List.of(new Document("namespace", "finos").append("adrId", 1).append("name", "   ")));
        stubRevisions(List.of("1"), new Document("title", "Resolved Title"));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        step.backfill();

        ArgumentCaptor<Bson> updateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection).updateOne(any(Bson.class), updateCaptor.capture());
        assertThat(updateCaptor.getValue().toBsonDocument().toJson(), containsString("Resolved Title"));
    }

    @Test
    void default_to_untitled_adr_when_the_latest_revision_has_no_title() throws Exception {
        stubHeaders(List.of(new Document("namespace", "finos").append("adrId", 1)));
        stubRevisions(List.of("1"), new Document("status", "draft"));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        step.backfill();

        ArgumentCaptor<Bson> updateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection).updateOne(any(Bson.class), updateCaptor.capture());
        assertThat(updateCaptor.getValue().toBsonDocument().toJson(), containsString("Untitled ADR"));
    }

    @Test
    void default_to_untitled_adr_when_there_is_no_readable_revision() throws Exception {
        stubHeaders(List.of(new Document("namespace", "finos").append("adrId", 1)));
        stubRevisions(List.of(), null);
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        step.backfill();

        ArgumentCaptor<Bson> updateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection).updateOne(any(Bson.class), updateCaptor.capture());
        assertThat(updateCaptor.getValue().toBsonDocument().toJson(), containsString("Untitled ADR"));
    }

    @Test
    void skip_a_malformed_header_with_no_namespace_or_adr_id() {
        stubHeaders(List.of(new Document("adrId", 1)));

        step.backfill();

        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }
}
