package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestNitriteSearchStoreShould {

    @Mock
    private Nitrite db;

    @Mock
    private NitriteCollection architectureCollection;

    @Mock
    private NitriteCollection patternCollection;

    @Mock
    private NitriteCollection flowCollection;

    @Mock
    private NitriteCollection standardCollection;

    @Mock
    private NitriteCollection interfaceCollection;

    @Mock
    private NitriteCollection controlCollection;

    @Mock
    private NitriteCollection adrCollection;

    private NitriteSearchStore searchStore;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(db.getCollection("architectures")).thenReturn(architectureCollection);
        when(db.getCollection("patterns")).thenReturn(patternCollection);
        when(db.getCollection("flows")).thenReturn(flowCollection);
        when(db.getCollection("standards")).thenReturn(standardCollection);
        when(db.getCollection("interfaces")).thenReturn(interfaceCollection);
        when(db.getCollection("controls")).thenReturn(controlCollection);
        when(db.getCollection("adrs")).thenReturn(adrCollection);
        searchStore = new NitriteSearchStore(db);
    }

    @Test
    void return_matching_architecture_results() {
        Document archEntry = Document.createDocument("architectureId", 1)
                .put("name", "Payment Architecture")
                .put("description", "Handles payments");
        Document namespaceDoc = Document.createDocument("namespace", "finos")
                .put("architectures", List.of(archEntry));

        mockCollectionFind(architectureCollection, List.of(namespaceDoc));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("payment");

        assertEquals(1, results.getArchitectures().size());
        SearchResult result = results.getArchitectures().get(0);
        assertEquals("finos", result.getNamespace());
        assertEquals(1, result.getId());
        assertEquals("Payment Architecture", result.getName());
    }

    @Test
    void return_matching_results_case_insensitive() {
        Document archEntry = Document.createDocument("architectureId", 1)
                .put("name", "Payment Architecture")
                .put("description", "desc");
        Document namespaceDoc = Document.createDocument("namespace", "finos")
                .put("architectures", List.of(archEntry));

        mockCollectionFind(architectureCollection, List.of(namespaceDoc));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("PAYMENT");

        assertEquals(1, results.getArchitectures().size());
    }

    @Test
    void return_empty_results_when_no_matches() {
        Document archEntry = Document.createDocument("architectureId", 1)
                .put("name", "Payment Architecture")
                .put("description", "desc");
        Document namespaceDoc = Document.createDocument("namespace", "finos")
                .put("architectures", List.of(archEntry));

        mockCollectionFind(architectureCollection, List.of(namespaceDoc));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("nonexistent");

        assertTrue(results.getArchitectures().isEmpty());
    }

    @Test
    void return_matching_results_from_description() {
        Document archEntry = Document.createDocument("architectureId", 1)
                .put("name", "Some Architecture")
                .put("description", "Handles payment processing");
        Document namespaceDoc = Document.createDocument("namespace", "finos")
                .put("architectures", List.of(archEntry));

        mockCollectionFind(architectureCollection, List.of(namespaceDoc));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("payment");

        assertEquals(1, results.getArchitectures().size());
    }

    @Test
    void search_controls_by_domain() {
        Document controlEntry = Document.createDocument("controlId", 1)
                .put("name", "API Rate Limiting")
                .put("description", "Rate limit control");
        Document domainDoc = Document.createDocument("domain", "api-threats")
                .put("controls", List.of(controlEntry));

        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, adrCollection);
        mockCollectionFind(controlCollection, List.of(domainDoc));

        GroupedSearchResults results = searchStore.search("rate");

        assertEquals(1, results.getControls().size());
        assertEquals("api-threats", results.getControls().get(0).getNamespace());
    }

    @Test
    void search_adr_by_latest_revision_title() {
        Document revisionDoc = Document.createDocument("title", "Use Event Sourcing");
        Document adrEntry = Document.createDocument("adrId", 1)
                .put("revisions", Map.of("1", revisionDoc));
        Document namespaceDoc = Document.createDocument("namespace", "finos")
                .put("adrs", List.of(adrEntry));

        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, controlCollection);
        mockCollectionFind(adrCollection, List.of(namespaceDoc));

        GroupedSearchResults results = searchStore.search("event");

        assertEquals(1, results.getAdrs().size());
        assertEquals("Use Event Sourcing", results.getAdrs().get(0).getName());
    }

    @Test
    void search_adr_uses_latest_revision_when_multiple_exist() {
        Document revisionDoc1 = Document.createDocument("title", "Old Title");
        Document revisionDoc2 = Document.createDocument("title", "New Title");
        Document adrEntry = Document.createDocument("adrId", 1)
                .put("revisions", Map.of("1", revisionDoc1, "2", revisionDoc2));
        Document namespaceDoc = Document.createDocument("namespace", "finos")
                .put("adrs", List.of(adrEntry));

        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, controlCollection);
        mockCollectionFind(adrCollection, List.of(namespaceDoc));

        GroupedSearchResults results = searchStore.search("New");

        assertEquals(1, results.getAdrs().size());
        assertEquals("New Title", results.getAdrs().get(0).getName());
    }

    @Test
    void handle_empty_collections() {
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
    void handle_null_entries_array_gracefully() {
        Document namespaceDoc = Document.createDocument("namespace", "finos")
                .put("architectures", null);

        mockCollectionFind(architectureCollection, List.of(namespaceDoc));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("test");

        assertTrue(results.getArchitectures().isEmpty());
    }

    @Test
    void match_literal_special_characters_in_query() {
        Document archEntry = Document.createDocument("architectureId", 1)
                .put("name", "test.arch")
                .put("description", "desc");
        Document namespaceDoc = Document.createDocument("namespace", "finos")
                .put("architectures", List.of(archEntry));

        mockCollectionFind(architectureCollection, List.of(namespaceDoc));
        mockEmptyCollections(patternCollection, flowCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("test.arch");
        assertEquals(1, results.getArchitectures().size());

        GroupedSearchResults results2 = searchStore.search("test_arch");
        assertTrue(results2.getArchitectures().isEmpty());
    }

    @Test
    void return_results_from_multiple_collections() {
        Document archEntry = Document.createDocument("architectureId", 1)
                .put("name", "Demo Architecture")
                .put("description", "demo");
        Document archDoc = Document.createDocument("namespace", "finos")
                .put("architectures", List.of(archEntry));

        Document flowEntry = Document.createDocument("flowId", 3)
                .put("name", "Demo Flow")
                .put("description", "demo");
        Document flowDoc = Document.createDocument("namespace", "finos")
                .put("flows", List.of(flowEntry));

        mockCollectionFind(architectureCollection, List.of(archDoc));
        mockCollectionFind(flowCollection, List.of(flowDoc));
        mockEmptyCollections(patternCollection, standardCollection,
                interfaceCollection, controlCollection, adrCollection);

        GroupedSearchResults results = searchStore.search("demo");

        assertEquals(1, results.getArchitectures().size());
        assertEquals(1, results.getFlows().size());
    }

    @Test
    void cap_results_at_max_per_type() {
        List<Document> entries = new ArrayList<>();
        for (int i = 0; i < SearchStore.MAX_RESULTS_PER_TYPE + 10; i++) {
            entries.add(Document.createDocument("architectureId", i)
                    .put("name", "Match " + i)
                    .put("description", "desc"));
        }
        Document namespaceDoc = Document.createDocument("namespace", "finos")
                .put("architectures", entries);

        mockCollectionFind(architectureCollection, List.of(namespaceDoc));
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
        // First namespace document is "secret-ns" and contains MAX+10 matches the
        // user is NOT allowed to read; second is "finos" with one allowed match.
        List<Document> secretEntries = new ArrayList<>();
        for (int i = 0; i < SearchStore.MAX_RESULTS_PER_TYPE + 10; i++) {
            secretEntries.add(Document.createDocument("architectureId", i)
                    .put("name", "Match " + i)
                    .put("description", "desc"));
        }
        Document secretNs = Document.createDocument("namespace", "secret-ns")
                .put("architectures", secretEntries);

        Document allowedEntry = Document.createDocument("architectureId", 999)
                .put("name", "Allowed Match")
                .put("description", "desc");
        Document allowedNs = Document.createDocument("namespace", "finos")
                .put("architectures", List.of(allowedEntry));

        mockCollectionFind(architectureCollection, List.of(secretNs, allowedNs));
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
        Document controlEntry = Document.createDocument("controlId", 1)
                .put("name", "API Rate Limiting")
                .put("description", "Rate limit control");
        Document domainDoc = Document.createDocument("domain", "api-threats")
                .put("controls", List.of(controlEntry));

        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, adrCollection);
        mockCollectionFind(controlCollection, List.of(domainDoc));

        // The user has no namespace grants but controls must still be returned
        // because they are domain-scoped.
        GroupedSearchResults results = searchStore.search("rate", Optional.of(Set.of()));

        assertEquals(1, results.getControls().size());
        assertEquals("api-threats", results.getControls().get(0).getNamespace());
    }

    @Test
    void filter_adrs_by_readable_namespaces() {
        Document allowedRev = Document.createDocument("title", "Allowed ADR");
        Document allowedAdr = Document.createDocument("adrId", 1)
                .put("revisions", Map.of("1", allowedRev));
        Document allowedNs = Document.createDocument("namespace", "finos")
                .put("adrs", List.of(allowedAdr));

        Document forbiddenRev = Document.createDocument("title", "Forbidden ADR");
        Document forbiddenAdr = Document.createDocument("adrId", 2)
                .put("revisions", Map.of("1", forbiddenRev));
        Document forbiddenNs = Document.createDocument("namespace", "secret-ns")
                .put("adrs", List.of(forbiddenAdr));

        mockEmptyCollections(architectureCollection, patternCollection, flowCollection,
                standardCollection, interfaceCollection, controlCollection);
        mockCollectionFind(adrCollection, List.of(allowedNs, forbiddenNs));

        GroupedSearchResults results = searchStore.search("ADR",
                Optional.of(Set.of("finos")));

        assertEquals(1, results.getAdrs().size());
        assertEquals("Allowed ADR", results.getAdrs().get(0).getName());
    }

    private void mockCollectionFind(NitriteCollection collection, List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(collection.find()).thenReturn(cursor);

        @SuppressWarnings("unchecked")
        Iterator<Document> iterator = mock(Iterator.class);
        when(cursor.iterator()).thenReturn(iterator);

        if (documents.isEmpty()) {
            when(iterator.hasNext()).thenReturn(false);
        } else {
            Boolean[] hasNextValues = new Boolean[documents.size() + 1];
            for (int i = 0; i < documents.size(); i++) {
                hasNextValues[i] = true;
            }
            hasNextValues[documents.size()] = false;

            when(iterator.hasNext()).thenReturn(hasNextValues[0],
                    java.util.Arrays.copyOfRange(hasNextValues, 1, hasNextValues.length));
            when(iterator.next()).thenReturn(documents.get(0),
                    documents.subList(1, documents.size()).toArray(new Document[0]));
        }
    }

    private void mockEmptyCollections(NitriteCollection... collections) {
        for (NitriteCollection collection : collections) {
            mockCollectionFind(collection, List.of());
        }
    }
}
