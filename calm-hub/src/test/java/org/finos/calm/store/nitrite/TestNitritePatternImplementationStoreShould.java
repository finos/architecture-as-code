package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.domain.implementations.PatternImplementation;
import org.finos.calm.domain.implementations.PatternImplementations;
import org.finos.calm.store.PageRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestNitritePatternImplementationStoreShould {

    private static final String REFERENCE =
            "https://hub.corp.com/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0";

    @Mock
    private Nitrite db;

    @Mock
    private NitriteCollection architectureVersions;

    private NitritePatternImplementationStore store;

    @BeforeEach
    void setUp() {
        when(db.getCollection("architectureVersions")).thenReturn(architectureVersions);
        store = new NitritePatternImplementationStore(db);
    }

    /** Nitrite stores an architecture's content as a JSON string, not a nested document. */
    private static Document version(String namespace, int architectureId, String version, String schema) {
        String content = schema == null
                ? "{\"nodes\":[]}"
                : "{\"$schema\":\"" + schema + "\",\"nodes\":[]}";
        return Document.createDocument("namespace", namespace)
                .put("architectureId", architectureId)
                .put("version", version)
                .put("content", content);
    }

    private void stubCollection(List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(architectureVersions.find()).thenReturn(cursor);
        when(cursor.iterator()).thenReturn(documents.iterator());
    }

    private PatternImplementations find(Optional<Set<String>> readableNamespaces) {
        return store.findImplementations("finos", "api-gateway", "1.0.0", readableNamespaces, PageRequest.UNPAGED);
    }

    @Test
    void return_the_architecture_versions_that_name_the_pattern() {
        stubCollection(List.of(
                version("finos", 7, "1.2.0", REFERENCE),
                version("finos", 8, "1.0.0", "https://other.host/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0")));

        assertEquals(List.of(new PatternImplementation("finos", 7, "1.2.0", null)),
                find(Optional.empty()).getImplementations());
    }

    @Test
    void match_the_same_reference_written_under_a_different_host() {
        stubCollection(List.of(version("finos", 7, "1.2.0",
                "http://localhost:8080/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0")));

        assertEquals(1, find(Optional.empty()).getImplementations().size());
    }

    @Test
    void ignore_an_architecture_that_names_no_pattern() {
        stubCollection(List.of(
                version("finos", 7, "1.2.0", REFERENCE),
                version("finos", 8, "1.0.0", "https://calm.finos.org/release/1.2/meta/calm.json"),
                version("finos", 9, "1.0.0", null),
                version("finos", 10, "1.0.0", "https://calm.finos.org/getting-started/conference-signup.pattern.json")));

        assertEquals(1, find(Optional.empty()).getImplementations().size());
    }

    @Test
    void skip_content_that_will_not_parse_rather_than_failing_the_request() {
        stubCollection(List.of(
                Document.createDocument("namespace", "finos").put("architectureId", 8)
                        .put("version", "1.0.0").put("content", "{ this is not json"),
                version("finos", 7, "1.2.0", REFERENCE)));

        assertEquals(1, find(Optional.empty()).getImplementations().size());
    }

    @Test
    void exclude_namespaces_the_caller_cannot_read() {
        stubCollection(List.of(
                version("finos", 7, "1.2.0", REFERENCE),
                version("secret", 8, "1.0.0", REFERENCE),
                version("secret", 9, "1.0.0", "https://calm.finos.org/release/1.2/meta/calm.json")));

        assertEquals(List.of(new PatternImplementation("finos", 7, "1.2.0", null)),
                find(Optional.of(Set.of("finos"))).getImplementations());
    }

    @Test
    void skip_an_architecture_with_no_id_because_it_cannot_be_addressed() {
        stubCollection(List.of(
                Document.createDocument("namespace", "finos").put("version", "1.0.0")
                        .put("content", "{\"$schema\":\"" + REFERENCE + "\"}"),
                version("finos", 7, "1.2.0", REFERENCE)));

        assertEquals(List.of(new PatternImplementation("finos", 7, "1.2.0", null)),
                find(Optional.empty()).getImplementations());
    }

    @Test
    void skip_an_architecture_with_no_namespace_rather_than_asking_an_immutable_set_about_null() {
        stubCollection(List.of(
                Document.createDocument("architectureId", 8).put("version", "1.0.0")
                        .put("content", "{\"$schema\":\"" + REFERENCE + "\"}"),
                version("finos", 7, "1.2.0", REFERENCE)));

        assertEquals(List.of(new PatternImplementation("finos", 7, "1.2.0", null)),
                find(Optional.of(Set.of("finos"))).getImplementations());
    }

    @Test
    void match_a_stored_reference_whose_version_is_spelled_differently() {
        stubCollection(List.of(version("finos", 7, "1.2.0",
                "https://h/calm/namespaces/finos/patterns/api-gateway/versions/1-0-0")));

        assertEquals(1, find(Optional.empty()).getImplementations().size());
    }

    @Test
    void return_matches_in_the_same_order_as_the_mongo_query() {
        // find() order is undefined, so paging over it could repeat or drop a row between pages.
        stubCollection(List.of(
                version("traderx", 2, "1.0.0", REFERENCE),
                version("finos", 9, "2.0.0", REFERENCE),
                version("finos", 9, "1.0.0", REFERENCE),
                version("finos", 7, "1.0.0", REFERENCE)));

        assertEquals(List.of(
                        new PatternImplementation("finos", 7, "1.0.0", null),
                        new PatternImplementation("finos", 9, "1.0.0", null),
                        new PatternImplementation("finos", 9, "2.0.0", null),
                        new PatternImplementation("traderx", 2, "1.0.0", null)),
                find(Optional.empty()).getImplementations());
    }

    @Test
    void apply_a_paging_window_when_one_is_asked_for() {
        stubCollection(List.of(
                version("finos", 7, "1.0.0", REFERENCE),
                version("finos", 8, "1.0.0", REFERENCE),
                version("finos", 9, "1.0.0", REFERENCE)));

        PatternImplementations page = store.findImplementations("finos", "api-gateway", "1.0.0",
                Optional.empty(), new PageRequest(1, 1));

        assertEquals(List.of(new PatternImplementation("finos", 8, "1.0.0", null)), page.getImplementations());
    }
}
