package org.finos.calm.migration.steps;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;

import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
    private MongoDocumentIndexStep step;

    @BeforeEach
    void setup() {
        database = mock(MongoDatabase.class);
        documents = mock(DocumentMongoCollection.class);
        when(database.getCollection("documents")).thenReturn(documents);

        step = new MongoDocumentIndexStep(database);
        step.databaseMode = "mongo";
    }

    @Test
    void run_at_schema_version_fourteen() {
        assertThat(step.fromVersion(), is(14));
    }

    @Test
    void skip_index_creation_when_database_mode_is_not_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verifyNoInteractions(database);
    }

    @Test
    void create_the_unique_compound_index_on_documents() {
        ArgumentCaptor<IndexOptions> options = ArgumentCaptor.forClass(IndexOptions.class);

        step.apply();

        verify(documents)
                .createIndex(
                        eq(new Document("namespace", 1).append("documentType", 1)),
                        options.capture());
        assertThat(options.getValue().isUnique(), is(true));
    }

    @Test
    void create_indexes_without_needing_the_database_mode_configured() {
        MongoDocumentIndexStep unconfigured = new MongoDocumentIndexStep(database);

        unconfigured.createIndexes();

        verify(documents)
                .createIndex(
                        eq(new Document("namespace", 1).append("documentType", 1)),
                        org.mockito.ArgumentMatchers.any());
    }
}
