package org.finos.calm.migration.steps;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.mongodb.client.FindIterable;
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
    private interface DocumentFindIterable extends FindIterable<Document> {}

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
    void create_the_unique_header_and_version_indexes() {
        ArgumentCaptor<IndexOptions> options = ArgumentCaptor.forClass(IndexOptions.class);

        step.createIndexes();

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
                        org.mockito.ArgumentMatchers.any());
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

    @Test
    void migrate_an_embedded_document() {
        Document root = root("1-0-0", "# Markdown\r\n");
        stubRoots(root);

        step.apply();

        verify(documents).replaceOne(org.mockito.ArgumentMatchers.<org.bson.conversions.Bson>any(),
                org.mockito.ArgumentMatchers.<Document>any(), org.mockito.ArgumentMatchers.<com.mongodb.client.model.ReplaceOptions>any());
        ArgumentCaptor<Document> stored = ArgumentCaptor.forClass(Document.class);
        verify(documentVersions).replaceOne(eq(new Document("namespace", "finos")
                        .append("documentType", "knowledge").append("documentId", 7).append("version", "1.0.0")),
                stored.capture(), org.mockito.ArgumentMatchers.<com.mongodb.client.model.ReplaceOptions>any());
        assertThat(stored.getValue().getString("documentType"), is("knowledge"));
        assertThat(stored.getValue().get("content", Document.class).getString("documentMarkdown"), is("# Markdown\r\n"));
        verify(documents).deleteOne(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void reject_conflicting_canonical_versions() {
        Document root = root("1.0.0", "one");
        root.getList("documents", Document.class).getFirst().get("versions", Document.class).put("100", "two");
        stubRoots(root);
        assertThrows(IllegalStateException.class, step::apply);
    }

    @Test
    void reject_non_string_markdown() {
        stubRoots(root("1.0.0", 1));
        assertThrows(IllegalStateException.class, step::apply);
    }

    private void stubRoots(Document root) {
        DocumentFindIterable roots = mock(DocumentFindIterable.class);
        when(documents.find(org.mockito.ArgumentMatchers.any(org.bson.conversions.Bson.class))).thenReturn(roots);
        when(roots.projection(org.mockito.ArgumentMatchers.any())).thenReturn(roots);
        when(roots.first()).thenReturn(root);
        org.mockito.Mockito.doAnswer(invocation -> {
            java.util.function.Consumer<Document> consumer = invocation.getArgument(0);
            consumer.accept(root);
            return null;
        }).when(roots).forEach(org.mockito.ArgumentMatchers.any());
    }

    private static Document root(String version, Object markdown) {
        return new Document("namespace", "finos").append("documentType", "knowledge")
                .append("documents", java.util.List.of(new Document("documentId", 7).append("name", "name")
                        .append("description", "description").append("versions", new Document(version, markdown))));
    }
}
