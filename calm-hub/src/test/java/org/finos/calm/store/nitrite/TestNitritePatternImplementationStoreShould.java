package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.store.ArchitectureSchema;
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

    private static final String PATH = "/calm/namespaces/finos/patterns/api-gateway/versions/";
    private static final String REFERENCE = "https://hub.corp.com" + PATH + "1.0.0";

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

    private List<ArchitectureSchema> find(Optional<Set<String>> readableNamespaces) {
        return store.findSchemasContaining(PATH, readableNamespaces);
    }

    @Test
    void return_every_version_whose_schema_contains_the_path_with_that_schema() {
        String otherVersion = "https://other.host" + PATH + "2.0.0";
        stubCollection(List.of(version("finos", 7, "1.2.0", REFERENCE), version("finos", 8, "1.0.0", otherVersion)));

        assertEquals(List.of(
                        new ArchitectureSchema("finos", 7, "1.2.0", REFERENCE),
                        new ArchitectureSchema("finos", 8, "1.0.0", otherVersion)),
                find(Optional.empty()));
    }

    @Test
    void ignore_an_architecture_that_names_no_pattern() {
        stubCollection(List.of(
                version("finos", 7, "1.2.0", REFERENCE),
                version("finos", 8, "1.0.0", "https://calm.finos.org/release/1.2/meta/calm.json"),
                version("finos", 9, "1.0.0", null),
                version("finos", 10, "1.0.0", "https://calm.finos.org/getting-started/conference-signup.pattern.json")));

        assertEquals(1, find(Optional.empty()).size());
    }

    @Test
    void ignore_an_architecture_that_holds_the_path_outside_its_schema() {
        stubCollection(List.of(Document.createDocument("namespace", "finos").put("architectureId", 8)
                .put("version", "1.0.0")
                .put("content", "{\"$schema\":\"https://calm.finos.org/release/1.2/meta/calm.json\",\"note\":\"" + REFERENCE + "\"}")));

        assertEquals(List.of(), find(Optional.empty()));
    }

    @Test
    void skip_content_that_will_not_parse_rather_than_failing_the_request() {
        stubCollection(List.of(
                Document.createDocument("namespace", "finos").put("architectureId", 8)
                        .put("version", "1.0.0").put("content", "{ not json " + REFERENCE),
                version("finos", 7, "1.2.0", REFERENCE)));

        assertEquals(1, find(Optional.empty()).size());
    }

    @Test
    void exclude_namespaces_the_caller_cannot_read() {
        stubCollection(List.of(
                version("finos", 7, "1.2.0", REFERENCE),
                version("secret", 8, "1.0.0", REFERENCE)));

        assertEquals(List.of(new ArchitectureSchema("finos", 7, "1.2.0", REFERENCE)),
                find(Optional.of(Set.of("finos"))));
    }

    @Test
    void skip_an_architecture_with_no_id_because_it_cannot_be_addressed() {
        stubCollection(List.of(
                Document.createDocument("namespace", "finos").put("version", "1.0.0")
                        .put("content", "{\"$schema\":\"" + REFERENCE + "\"}"),
                version("finos", 7, "1.2.0", REFERENCE)));

        assertEquals(List.of(new ArchitectureSchema("finos", 7, "1.2.0", REFERENCE)), find(Optional.empty()));
    }

    @Test
    void skip_an_architecture_with_no_namespace_rather_than_asking_an_immutable_set_about_null() {
        stubCollection(List.of(
                Document.createDocument("architectureId", 8).put("version", "1.0.0")
                        .put("content", "{\"$schema\":\"" + REFERENCE + "\"}"),
                version("finos", 7, "1.2.0", REFERENCE)));

        assertEquals(List.of(new ArchitectureSchema("finos", 7, "1.2.0", REFERENCE)),
                find(Optional.of(Set.of("finos"))));
    }
}
