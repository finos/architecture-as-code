package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import org.bson.Document;
import org.bson.codecs.configuration.CodecRegistry;
import org.bson.conversions.Bson;
import org.finos.calm.domain.implementations.PatternImplementation;
import org.finos.calm.domain.implementations.PatternImplementations;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.util.PatternReferenceMatcher;
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
import static org.mockito.Mockito.when;

class TestMongoPatternImplementationStoreShould {

    private static final String SCHEMA_FIELD = "content.$schema";

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

    private static Document implementation(String namespace, int architectureId, String version) {
        return new Document("namespace", namespace)
                .append("architectureId", architectureId)
                .append("version", version);
    }

    private FindIterable<Document> stubFind(List<Document> documents) {
        FindIterable<Document> findIterable = mock(DocumentFindIterable.class);
        MongoCursor<Document> cursor = mock(DocumentMongoCursor.class);
        when(architectureVersions.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.sort(any())).thenReturn(findIterable);
        when(findIterable.projection(any())).thenReturn(findIterable);
        when(findIterable.skip(anyInt())).thenReturn(findIterable);
        when(findIterable.limit(anyInt())).thenReturn(findIterable);
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

    @Test
    void return_the_architecture_versions_that_name_the_pattern() {
        stubFind(List.of(implementation("finos", 7, "1.2.0"), implementation("finos", 9, "2.0.0")));

        PatternImplementations result =
                store.findImplementations("finos", "api-gateway", "1.0.0", Optional.empty(), PageRequest.UNPAGED);

        assertEquals(List.of(
                        new PatternImplementation("finos", 7, "1.2.0", null),
                        new PatternImplementation("finos", 9, "2.0.0", null)),
                result.getImplementations());
        assertEquals("api-gateway", result.getPattern().getName());
        assertEquals("1.0.0", result.getPattern().getVersion());
    }

    @Test
    void skip_an_architecture_missing_an_id_or_a_namespace_because_it_cannot_be_addressed() {
        stubFind(List.of(
                new Document("namespace", "finos").append("version", "1.0.0"),
                new Document("architectureId", 8).append("version", "1.0.0"),
                implementation("finos", 7, "1.2.0")));

        PatternImplementations result =
                store.findImplementations("finos", "api-gateway", "1.0.0", Optional.empty(), PageRequest.UNPAGED);

        assertEquals(List.of(new PatternImplementation("finos", 7, "1.2.0", null)), result.getImplementations());
    }

    @Test
    void skip_an_architecture_whose_id_or_namespace_has_the_wrong_type() {
        stubFind(List.of(
                new Document("namespace", "finos").append("architectureId", "8").append("version", "1.0.0"),
                new Document("namespace", 3).append("architectureId", 9).append("version", "1.0.0"),
                implementation("finos", 7, "1.2.0")));

        PatternImplementations result =
                store.findImplementations("finos", "api-gateway", "1.0.0", Optional.empty(), PageRequest.UNPAGED);

        assertEquals(List.of(new PatternImplementation("finos", 7, "1.2.0", null)), result.getImplementations());
    }

    @Test
    void push_a_requested_paging_window_down_to_the_query() {
        FindIterable<Document> matches = stubFind(List.of());

        store.findImplementations("finos", "api-gateway", "1.0.0", Optional.empty(), new PageRequest(2, 5));

        org.mockito.Mockito.verify(matches).skip(5);
        org.mockito.Mockito.verify(matches).limit(2);
    }

    @Test
    void ask_the_query_for_no_window_when_the_caller_wants_every_match() {
        FindIterable<Document> matches = stubFind(List.of());

        store.findImplementations("finos", "api-gateway", "1.0.0", Optional.empty(), PageRequest.UNPAGED);

        org.mockito.Mockito.verify(matches, org.mockito.Mockito.never()).skip(anyInt());
        org.mockito.Mockito.verify(matches, org.mockito.Mockito.never()).limit(anyInt());
    }

    @Test
    void match_on_the_path_of_the_reference_and_never_the_host() {
        stubFind(List.of());

        store.findImplementations("finos", "api-gateway", "1.0.0", Optional.empty(), PageRequest.UNPAGED);

        ArgumentCaptor<Bson> filter = ArgumentCaptor.forClass(Bson.class);
        org.mockito.Mockito.verify(architectureVersions).find(filter.capture());
        String rendered = render(filter.getValue());

        assertTrue(rendered.contains("/calm/namespaces/finos/patterns/api-gateway/versions/"),
                "expected a path-only expression, got: " + rendered);
        assertFalse(rendered.contains("http"), "the host must not appear in the filter: " + rendered);
        assertTrue(rendered.contains(SCHEMA_FIELD), "expected the filter to read $schema, got: " + rendered);
    }

    @Test
    void restrict_the_matches_to_the_readable_namespaces() {
        stubFind(List.of());

        store.findImplementations("finos", "api-gateway", "1.0.0", Optional.of(Set.of("finos", "traderx")), PageRequest.UNPAGED);

        ArgumentCaptor<Bson> filter = ArgumentCaptor.forClass(Bson.class);
        org.mockito.Mockito.verify(architectureVersions).find(filter.capture());
        assertTrue(render(filter.getValue()).contains("namespace"),
                "query was not scoped to readable namespaces: " + render(filter.getValue()));
    }

    @Test
    void exclude_unaddressable_rows_in_the_query_so_a_page_is_never_short() {
        stubFind(List.of());

        store.findImplementations("finos", "api-gateway", "1.0.0", Optional.empty(), new PageRequest(2, 0));

        ArgumentCaptor<Bson> filter = ArgumentCaptor.forClass(Bson.class);
        org.mockito.Mockito.verify(architectureVersions).find(filter.capture());
        String rendered = render(filter.getValue());

        // Dropping them after skip/limit returns a short page, which a caller reads as the last one.
        assertTrue(rendered.contains("architectureId"), "architectureId must be constrained: " + rendered);
        assertTrue(rendered.contains("$ne") || rendered.contains("$exists"),
                "unaddressable rows must be excluded by the query: " + rendered);
    }

    @Test
    void sort_the_query_so_a_paging_window_is_stable() {
        FindIterable<Document> matches = stubFind(List.of());

        store.findImplementations("finos", "api-gateway", "1.0.0", Optional.empty(), new PageRequest(2, 5));

        // Without a sort MongoDB has no defined order, so consecutive pages could repeat a row or
        // drop one, and a dropped implementation reads as a pattern nothing depends on.
        org.mockito.Mockito.verify(matches).sort(any());
        org.mockito.Mockito.verify(matches).skip(5);
        org.mockito.Mockito.verify(matches).limit(2);
    }

    @Test
    void ask_only_for_spellings_that_mean_the_same_version() {
        stubFind(List.of());

        store.findImplementations("finos", "api-gateway", "1.10.0", Optional.empty(), PageRequest.UNPAGED);

        ArgumentCaptor<Bson> filter = ArgumentCaptor.forClass(Bson.class);
        org.mockito.Mockito.verify(architectureVersions).find(filter.capture());
        String rendered = render(filter.getValue());

        // 1100 reads as 11.0.0, so an expression that allowed both separators to be dropped would
        // list an architecture of that pattern version as an implementation of 1.10.0, while the
        // in-memory path rejects it. Asserted on spellings that need no escaping.
        assertTrue(rendered.contains("1-10-0"), "expected the dashed spelling, got: " + rendered);
        assertFalse(rendered.contains("1100"), "1100 means 11.0.0 and must not be matched: " + rendered);
    }

    /**
     * The driver is asked to serialise the filter for real. MongoDB rejects a {@code $}-prefixed
     * field name in an index and in a projection, so the whole design rests on it being accepted in
     * a query — a mocked collection would never catch it being rejected client-side.
     */
    @Test
    void build_a_filter_on_a_dollar_prefixed_field_without_the_driver_rejecting_it() {
        CodecRegistry registry = getDefaultCodecRegistry();

        String rendered = Filters.regex(SCHEMA_FIELD,
                        PatternReferenceMatcher.referenceTo("finos", "api-gateway", "1.0.0"))
                .toBsonDocument(org.bson.BsonDocument.class, registry)
                .toJson();

        assertTrue(rendered.contains("content.$schema"), rendered);
        assertTrue(rendered.contains("regularExpression") || rendered.contains("$regex"), rendered);
    }

    private static String render(Bson filter) {
        return filter.toBsonDocument(org.bson.BsonDocument.class, getDefaultCodecRegistry()).toJson();
    }
}
