package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.store.ArchitectureSchema;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static com.mongodb.MongoClientSettings.getDefaultCodecRegistry;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TestMongoPatternImplementationStoreShould {

    private static final String PATH = "/calm/namespaces/finos/patterns/api-gateway/versions/";
    private static final String REFERENCE = "https://h" + PATH + "1.0.0";

    // Typed subinterfaces so the mocks need no unchecked cast — see calm-hub/AGENTS.md.
    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentMongoCursor extends MongoCursor<Document> {
    }

    @Mock
    private MongoDatabase database;

    private MongoCollection<Document> architectureVersions;

    private MongoPatternImplementationStore store;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        architectureVersions = mock(DocumentMongoCollection.class);
        when(database.getCollection("architectureVersions")).thenReturn(architectureVersions);
        store = new MongoPatternImplementationStore(database);
    }

    private static Document row(String namespace, int architectureId, String version, String schema) {
        return new Document("namespace", namespace)
                .append("architectureId", architectureId)
                .append("version", version)
                .append("schema", schema);
    }

    private FindIterable<Document> stubFind(List<Document> documents) {
        FindIterable<Document> findIterable = mock(DocumentFindIterable.class);
        MongoCursor<Document> cursor = mock(DocumentMongoCursor.class);
        when(architectureVersions.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.projection(any())).thenReturn(findIterable);
        when(findIterable.iterator()).thenReturn(cursor);

        if (documents.isEmpty()) {
            when(cursor.hasNext()).thenReturn(false);
        } else {
            Boolean[] hasNext = new Boolean[documents.size() + 1];
            Arrays.fill(hasNext, 0, documents.size(), true);
            hasNext[documents.size()] = false;
            when(cursor.hasNext()).thenReturn(hasNext[0], Arrays.copyOfRange(hasNext, 1, hasNext.length));
            when(cursor.next()).thenReturn(documents.get(0),
                    documents.subList(1, documents.size()).toArray(new Document[0]));
        }
        return findIterable;
    }

    private List<ArchitectureSchema> find(Optional<Set<String>> readableNamespaces) {
        return store.findSchemasContaining(PATH, readableNamespaces);
    }

    private String renderedFilter() {
        ArgumentCaptor<Bson> filter = ArgumentCaptor.forClass(Bson.class);
        verify(architectureVersions).find(filter.capture());
        return render(filter.getValue());
    }

    @Test
    void return_each_candidate_with_its_schema() {
        stubFind(List.of(row("finos", 7, "1.2.0", REFERENCE), row("finos", 9, "2.0.0", "https://h" + PATH + "2.0.0")));

        assertEquals(List.of(
                        new ArchitectureSchema("finos", 7, "1.2.0", REFERENCE),
                        new ArchitectureSchema("finos", 9, "2.0.0", "https://h" + PATH + "2.0.0")),
                find(Optional.empty()));
    }

    @Test
    void skip_a_row_missing_an_id_a_namespace_or_a_schema() {
        stubFind(List.of(
                new Document("namespace", "finos").append("version", "1.0.0").append("schema", REFERENCE),
                new Document("architectureId", 8).append("version", "1.0.0").append("schema", REFERENCE),
                new Document("namespace", "finos").append("architectureId", 9).append("version", "1.0.0"),
                row("finos", 7, "1.2.0", REFERENCE)));

        assertEquals(List.of(new ArchitectureSchema("finos", 7, "1.2.0", REFERENCE)), find(Optional.empty()));
    }

    @Test
    void skip_a_row_whose_id_namespace_or_schema_has_the_wrong_type() {
        stubFind(List.of(
                new Document("namespace", "finos").append("architectureId", "8").append("schema", REFERENCE),
                new Document("namespace", 3).append("architectureId", 9).append("schema", REFERENCE),
                new Document("namespace", "finos").append("architectureId", 10).append("schema", 1),
                row("finos", 7, "1.2.0", REFERENCE)));

        assertEquals(List.of(new ArchitectureSchema("finos", 7, "1.2.0", REFERENCE)), find(Optional.empty()));
    }

    @Test
    void filter_on_the_quoted_path_of_the_schema_and_never_the_host() {
        stubFind(List.of());

        find(Optional.empty());

        String rendered = renderedFilter();
        assertTrue(rendered.contains("content.$schema"), rendered);
        assertTrue(rendered.contains("\\\\Q" + PATH + "\\\\E"), "expected a quoted path, got: " + rendered);
        assertFalse(rendered.contains("http"), "the host must not appear in the filter: " + rendered);
    }

    @Test
    void restrict_the_candidates_to_the_readable_namespaces() {
        stubFind(List.of());

        find(Optional.of(Set.of("finos")));

        assertTrue(renderedFilter().contains("{\"namespace\": {\"$in\": [\"finos\"]}}"));
    }

    @Test
    void read_the_schema_through_object_to_array_because_a_dollar_field_cannot_be_projected() {
        FindIterable<Document> matches = stubFind(List.of());

        find(Optional.empty());

        ArgumentCaptor<Bson> projection = ArgumentCaptor.forClass(Bson.class);
        verify(matches).projection(projection.capture());
        String rendered = render(projection.getValue());
        assertTrue(rendered.contains("$objectToArray"), rendered);
        assertTrue(rendered.contains("{\"$literal\": \"$schema\"}"), rendered);
        assertFalse(rendered.contains("content.$schema"), rendered);
    }

    @Test
    void leave_the_order_and_the_paging_to_the_caller() {
        FindIterable<Document> matches = stubFind(List.of());

        find(Optional.empty());

        verify(matches, never()).sort(any());
        verify(matches, never()).skip(anyInt());
        verify(matches, never()).limit(anyInt());
    }

    private static String render(Bson bson) {
        return bson.toBsonDocument(BsonDocument.class, getDefaultCodecRegistry()).toJson();
    }
}
