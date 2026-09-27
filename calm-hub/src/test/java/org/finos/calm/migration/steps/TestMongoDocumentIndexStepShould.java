package org.finos.calm.migration.steps;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;

import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoDocumentIndexStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {}

    private MongoDatabase database;
    private MongoCollection<Document> documents;
    private MongoCollection<Document> documentVersions;
    private MongoDocumentIndexStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        documents = mock(DocumentMongoCollection.class);
        documentVersions = mock(DocumentMongoCollection.class);
        when(database.getCollection("documents")).thenReturn(documents);
        when(database.getCollection("documentVersions")).thenReturn(documentVersions);

        step = new MongoDocumentIndexStep(database);
        step.databaseMode = "mongo";
    }

    @Test
    void run_at_schema_version_fifteen() {
        assertThat(step.fromVersion(), is(15));
    }

    @Test
    void skip_index_creation_when_database_mode_is_not_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verifyNoInteractions(database);
    }

    @Test
    void create_only_the_unique_header_and_version_indexes_when_applied() {
        ArgumentCaptor<IndexOptions> options = ArgumentCaptor.forClass(IndexOptions.class);

        step.apply();

        verify(documents)
                .createIndex(
                        eq(new Document("namespace", 1).append("documentType", 1).append("documentId", 1)),
                        options.capture());
        assertThat(options.getValue().isUnique(), is(true));
        verify(documentVersions)
                .createIndex(
                        eq(new Document("namespace", 1)
                                .append("documentType", 1)
                                .append("documentId", 1)
                                .append("version", 1)),
                        options.capture());
        assertThat(options.getValue().isUnique(), is(true));
        verifyNoMoreInteractions(documents, documentVersions);
    }

    @Test
    void create_indexes_without_needing_the_database_mode_configured() {
        MongoDocumentIndexStep unconfigured = new MongoDocumentIndexStep(database);

        unconfigured.createIndexes();

        verify(documents)
                .createIndex(
                        eq(new Document("namespace", 1).append("documentType", 1).append("documentId", 1)),
                        org.mockito.ArgumentMatchers.any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"documents", "documentVersions"})
    void propagate_index_creation_failures(String collection) {
        RuntimeException failure = new IllegalStateException("Index creation failed");
        when(database.getCollection(collection).createIndex(any(), any(IndexOptions.class))).thenThrow(failure);

        assertThat(assertThrows(RuntimeException.class, step::apply), is(failure));
    }
}
