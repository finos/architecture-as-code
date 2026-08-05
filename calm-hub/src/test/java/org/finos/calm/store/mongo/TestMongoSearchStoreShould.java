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
        searchStore = new MongoSearchStore(database);
    }

    /**
     * Architecture has moved to the header/version shape, so each of its documents is one
     * architecture rather than a namespace-wide array of them. The other namespaced types
     * still use the array shape, which is why both fixtures appear in this class.
     */
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

        // A flow, still in the array shape, alongside two header-shaped types — the point
        // being that both paths run in the same search while the rollout is part-done.
        Document flowDoc = new Document("namespace", "finos")
                .append("flows", List.of(new Document("flowId", 3)
                        .append("name", "Demo Flow")
                        .append("description", "demo")));

        mockCollectionFind(architectureCollection, List.of(archDoc));
        mockCollectionFind(patternCollection, List.of(patternDoc));
        mockCollectionFind(flowCollection, List.of(flowDoc));
        mockEmptyCollections(standardCollection, interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("demo");

        assertEquals(1, results.getArchitectures().size());
        assertEquals(1, results.getPatterns().size());
        assertEquals("Demo Pattern", results.getPatterns().get(0).getName());
        assertEquals(1, results.getFlows().size());
        assertEquals("Demo Flow", results.getFlows().get(0).getName());
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
    void search_adr_by_latest_revision_title() {
        Document revisionDoc = new Document("title", "Use Event Sourcing");
        Document adrEntry = new Document("adrId", 1)
                .append("revisions", new Document("1", revisionDoc));
        Document namespaceDoc = new Document("namespace", "finos")
                .append("adrs", List.of(adrEntry));

        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, controlCollection);
        mockCollectionFind(adrCollection, List.of(namespaceDoc));

        GroupedSearchResults results = searchStore.search("event");

        assertEquals(1, results.getAdrs().size());
        assertEquals("Use Event Sourcing", results.getAdrs().get(0).getName());
    }

    @Test
    void search_adr_uses_latest_revision_when_multiple_exist() {
        Document revisionDoc1 = new Document("title", "Old Title");
        Document revisionDoc2 = new Document("title", "New Title");
        Document adrEntry = new Document("adrId", 1)
                .append("revisions", new Document("1", revisionDoc1).append("2", revisionDoc2));
        Document namespaceDoc = new Document("namespace", "finos")
                .append("adrs", List.of(adrEntry));

        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, controlCollection);
        mockCollectionFind(adrCollection, List.of(namespaceDoc));

        GroupedSearchResults results = searchStore.search("New");

        assertEquals(1, results.getAdrs().size());
        assertEquals("New Title", results.getAdrs().get(0).getName());
    }

    @Test
    void handle_null_entries_array_gracefully() {
        // Uses a flow: only the array-shaped types can have a null entries array at all, so
        // this covers the branch where it still exists. It moves to another unmigrated type
        // each time one migrates — it was on architectures, then patterns.
        Document namespaceDoc = new Document("namespace", "finos")
                .append("flows", null);

        mockCollectionFind(flowCollection, List.of(namespaceDoc));
        mockEmptyCollections(architectureCollection, patternCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("test");

        assertTrue(results.getFlows().isEmpty());
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
