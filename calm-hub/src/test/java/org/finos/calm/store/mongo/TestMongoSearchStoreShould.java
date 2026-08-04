package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.MongoCursor;
import org.bson.Document;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestMongoSearchStoreShould {

    @Mock
    private MongoDatabase database;

    @Mock
    private MongoCollection<Document> architectureCollection;

    @Mock
    private MongoCollection<Document> patternCollection;

    @Mock
    private MongoCollection<Document> flowCollection;

    @Mock
    private MongoCollection<Document> standardCollection;

    @Mock
    private MongoCollection<Document> interfaceCollection;

    @Mock
    private MongoCollection<Document> controlCollection;

    @Mock
    private MongoCollection<Document> adrCollection;

    @Mock
    private MongoCollection<Document> adrVersionCollection;

    private MongoSearchStore searchStore;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(database.getCollection("architectures")).thenReturn(architectureCollection);
        when(database.getCollection("patterns")).thenReturn(patternCollection);
        when(database.getCollection("flows")).thenReturn(flowCollection);
        when(database.getCollection("standards")).thenReturn(standardCollection);
        when(database.getCollection("interfaces")).thenReturn(interfaceCollection);
        when(database.getCollection("controls")).thenReturn(controlCollection);
        when(database.getCollection("adrs")).thenReturn(adrCollection);
        when(database.getCollection("adrVersions")).thenReturn(adrVersionCollection);
        searchStore = new MongoSearchStore(database);
    }

    /**
     * Architecture has moved to the header/version shape, so each of its documents is one
     * architecture rather than a namespace-wide array of them. The other namespaced types
     * still use the array shape, which is why both fixtures appear in this class.
     */
    /**
     * Stubs the adrVersions collection the ADR search reads through: the revision list that
     * ranks them, and the winning revision's content.
     */
    @SuppressWarnings("unchecked")
    private void mockAdrRevisions(List<String> revisions, Document latestContent) {
        FindIterable<Document> findIterable = mock(FindIterable.class);
        when(adrVersionCollection.find(any(org.bson.conversions.Bson.class))).thenReturn(findIterable);
        when(findIterable.projection(any())).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(
                latestContent == null ? null : new Document("content", latestContent));
        doAnswer(invocation -> {
            java.util.function.Consumer<Document> consumer = invocation.getArgument(0);
            revisions.forEach(revision -> consumer.accept(new Document("version", revision)));
            return null;
        }).when(findIterable).forEach(any());
    }

    private static Document architectureHeader(int id, String name, String description) {
        return architectureHeader("finos", id, name, description);
    }

    private static Document architectureHeader(String namespace, int id, String name, String description) {
        return new Document("namespace", namespace)
                .append("architectureId", id)
                .append("name", name)
                .append("description", description);
    }

    @Test
    void return_matching_architecture_results() {
        mockCollectionFind(architectureCollection,
                List.of(architectureHeader(1, "Payment Architecture", "Handles payments")));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("payment");

        assertEquals(1, results.getArchitectures().size());
        SearchResult result = results.getArchitectures().get(0);
        assertEquals("finos", result.getNamespace());
        assertEquals(1, result.getId());
        assertEquals("Payment Architecture", result.getName());
        assertEquals("Handles payments", result.getDescription());
    }

    @Test
    void return_matching_results_case_insensitive() {
        mockCollectionFind(architectureCollection,
                List.of(architectureHeader(1, "Payment Architecture", "desc")));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("PAYMENT");

        assertEquals(1, results.getArchitectures().size());
    }

    @Test
    void return_matching_results_from_description() {
        mockCollectionFind(architectureCollection,
                List.of(architectureHeader(1, "Some Architecture", "Handles payment processing")));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("payment");

        assertEquals(1, results.getArchitectures().size());
    }

    @Test
    void return_empty_results_when_no_matches() {
        mockCollectionFind(architectureCollection,
                List.of(architectureHeader(1, "Payment Architecture", "desc")));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("nonexistent");

        assertTrue(results.getArchitectures().isEmpty());
    }

    @Test
    void return_results_from_multiple_collections() {
        Document archDoc = architectureHeader(1, "Demo Architecture", "demo");

        Document patternDoc = new Document("namespace", "finos")
                .append("patternId", 2)
                .append("name", "Demo Pattern")
                .append("description", "demo");

        Document flowDoc = new Document("namespace", "finos")
                .append("flowId", 3)
                .append("name", "Demo Flow")
                .append("description", "demo");

        // Every namespaced type now reads the header shape — the array-shaped path was
        // retired with Interface, its last caller.
        Document interfaceDoc = new Document("namespace", "finos")
                .append("interfaceId", 5)
                .append("name", "Demo Interface")
                .append("description", "demo");

        mockCollectionFind(architectureCollection, List.of(archDoc));
        mockCollectionFind(patternCollection, List.of(patternDoc));
        mockCollectionFind(flowCollection, List.of(flowDoc));
        mockCollectionFind(interfaceCollection, List.of(interfaceDoc));
        mockEmptyCollections(standardCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("demo");

        assertEquals(1, results.getArchitectures().size());
        assertEquals(1, results.getPatterns().size());
        assertEquals("Demo Pattern", results.getPatterns().get(0).getName());
        assertEquals(1, results.getFlows().size());
        assertEquals("Demo Flow", results.getFlows().get(0).getName());
        assertEquals(1, results.getInterfaces().size());
        assertEquals("Demo Interface", results.getInterfaces().get(0).getName());
    }

    @Test
    void search_controls_by_domain_not_namespace() {
        Document controlEntry = new Document("controlId", 1)
                .append("name", "API Rate Limiting")
                .append("description", "Rate limit control");
        Document domainDoc = new Document("domain", "api-threats")
                .append("controls", List.of(controlEntry));

        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, adrCollection);
        mockCollectionFind(controlCollection, List.of(domainDoc));

        GroupedSearchResults results = searchStore.search("rate");

        assertEquals(1, results.getControls().size());
        SearchResult result = results.getControls().get(0);
        assertEquals("api-threats", result.getNamespace());
        assertEquals("API Rate Limiting", result.getName());
    }

    @Test
    void skip_a_header_with_no_id_rather_than_failing_the_search() {
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);
        mockCollectionFind(architectureCollection, List.of(
                new Document("namespace", "finos").append("name", "event thing").append("description", "d")));

        // No architectureId. SearchResult takes a primitive id, so unboxing would throw out
        // of search() — which builds every type's results eagerly, failing the whole request
        // rather than one type.
        assertEquals(0, searchStore.search("event").getArchitectures().size());
    }

    @Test
    void skip_an_adr_header_with_no_id_rather_than_failing_the_search() {
        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, controlCollection);
        mockCollectionFind(adrCollection, List.of(new Document("namespace", "finos").append("adrId", null)));

        // SearchResult takes a primitive id and resolving the latest revision unboxes too, so
        // one id-less header would 500 the entire /search request — every type, not just ADR.
        assertEquals(0, searchStore.search("event").getAdrs().size());
    }

    @Test
    void search_adr_by_latest_revision_title() {
        // ADR reads its title from the latest revision's content, so the fixture needs a
        // header and a revision document rather than one namespace-wide document.
        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, controlCollection);
        mockCollectionFind(adrCollection, List.of(new Document("namespace", "finos").append("adrId", 1)));
        mockAdrRevisions(List.of("1"), new Document("title", "Use Event Sourcing"));

        GroupedSearchResults results = searchStore.search("event");

        assertEquals(1, results.getAdrs().size());
        assertEquals("Use Event Sourcing", results.getAdrs().get(0).getName());
    }

    @Test
    void search_adr_uses_latest_revision_when_multiple_exist() {
        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, controlCollection);
        mockCollectionFind(adrCollection, List.of(new Document("namespace", "finos").append("adrId", 1)));
        // Two revisions; the search must read the later one's title.
        mockAdrRevisions(List.of("1", "2"), new Document("title", "New Title"));

        GroupedSearchResults results = searchStore.search("New");

        assertEquals(1, results.getAdrs().size());
        assertEquals("New Title", results.getAdrs().get(0).getName());
    }


    @Test
    void handle_empty_collections_gracefully() {
        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("test");

        assertTrue(results.getArchitectures().isEmpty());
        assertTrue(results.getPatterns().isEmpty());
        assertTrue(results.getFlows().isEmpty());
        assertTrue(results.getStandards().isEmpty());
        assertTrue(results.getInterfaces().isEmpty());
        assertTrue(results.getControls().isEmpty());
        assertTrue(results.getAdrs().isEmpty());
    }

    @Test
    void match_literal_special_characters_in_query() {
        mockCollectionFind(architectureCollection, List.of(architectureHeader(1, "test.arch", "desc")));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        // Searching for "test.arch" should match literal dot as substring
        GroupedSearchResults results = searchStore.search("test.arch");
        assertEquals(1, results.getArchitectures().size());

        // "test_arch" should NOT match "test.arch"
        GroupedSearchResults results2 = searchStore.search("test_arch");
        assertTrue(results2.getArchitectures().isEmpty());
    }

    @Test
    void cap_results_at_max_per_type() {
        List<Document> headers = new ArrayList<>();
        for (int i = 0; i < SearchStore.MAX_RESULTS_PER_TYPE + 10; i++) {
            headers.add(architectureHeader(i, "Match " + i, "desc"));
        }

        // One document per architecture now, so the cap has to be applied across documents
        // rather than within a single document's array.
        mockCollectionFind(architectureCollection, headers);
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("match");

        assertEquals(SearchStore.MAX_RESULTS_PER_TYPE, results.getArchitectures().size());
    }

    /**
     * Regression test for PR #2366: namespace-based access filter must run
     * <em>before</em> the per-type cap so that a user with limited namespace
     * grants still receives authorised results that may live beyond the
     * unfiltered cap.
     */
    @Test
    void filter_namespaced_results_by_readable_namespaces_before_cap() {
        List<Document> headers = new ArrayList<>();
        for (int i = 0; i < SearchStore.MAX_RESULTS_PER_TYPE + 10; i++) {
            headers.add(architectureHeader("secret-ns", i, "Match " + i, "desc"));
        }
        // Ordered after the unreadable ones, so a cap applied before the namespace filter
        // would drop it.
        headers.add(architectureHeader(999, "Allowed Match", "desc"));

        mockCollectionFind(architectureCollection, headers);
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("match",
                Optional.of(Set.of("finos")));

        assertEquals(1, results.getArchitectures().size(),
                "filter must apply before MAX cap so authorised results are not silently dropped");
        assertEquals("Allowed Match", results.getArchitectures().get(0).getName());
        assertEquals("finos", results.getArchitectures().get(0).getNamespace());
    }

    /**
     * Regression test for PR #2366: controls are scoped by domain, not namespace,
     * so the readable-namespaces filter must not be applied to them — otherwise
     * controls would always be filtered out for any authenticated user.
     */
    @Test
    void return_controls_regardless_of_readable_namespaces() {
        Document controlEntry = new Document("controlId", 1)
                .append("name", "API Rate Limiting")
                .append("description", "Rate limit control");
        Document domainDoc = new Document("domain", "api-threats")
                .append("controls", List.of(controlEntry));

        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, adrCollection);
        mockCollectionFind(controlCollection, List.of(domainDoc));

        GroupedSearchResults results = searchStore.search("rate", Optional.of(Set.of()));

        assertEquals(1, results.getControls().size());
        assertEquals("api-threats", results.getControls().get(0).getNamespace());
    }

    @SuppressWarnings("unchecked")
    private void mockCollectionFind(MongoCollection<Document> collection, List<Document> documents) {
        FindIterable<Document> findIterable = mock(FindIterable.class);
        MongoCursor<Document> cursor = mock(MongoCursor.class);
        when(collection.find()).thenReturn(findIterable);
        when(findIterable.iterator()).thenReturn(cursor);

        if (documents.isEmpty()) {
            when(cursor.hasNext()).thenReturn(false);
        } else {
            Boolean[] hasNextValues = new Boolean[documents.size() + 1];
            for (int i = 0; i < documents.size(); i++) {
                hasNextValues[i] = true;
            }
            hasNextValues[documents.size()] = false;

            when(cursor.hasNext()).thenReturn(hasNextValues[0],
                    java.util.Arrays.copyOfRange(hasNextValues, 1, hasNextValues.length));
            when(cursor.next()).thenReturn(documents.get(0),
                    documents.subList(1, documents.size()).toArray(new Document[0]));
        }
    }

    @SafeVarargs
    private void mockEmptyCollections(MongoCollection<Document>... collections) {
        for (MongoCollection<Document> collection : collections) {
            mockCollectionFind(collection, List.of());
        }
    }
}
