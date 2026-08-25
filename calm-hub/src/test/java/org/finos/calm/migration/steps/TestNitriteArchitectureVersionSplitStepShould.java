package org.finos.calm.migration.steps;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.collection.NitriteId;
import org.dizitart.no2.filters.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestNitriteArchitectureVersionSplitStepShould {

    private static final String CONTENT_1_0_0 = "{\"nodes\":[]}";
    private static final String CONTENT_1_1_0 = "{\"nodes\":[1]}";

    private Nitrite db;
    private NitriteCollection headers;
    private NitriteCollection versions;
    private NitriteArchitectureVersionSplitStep step;

    @BeforeEach
    void setup() {
        db = mock(Nitrite.class);
        headers = mock(NitriteCollection.class);
        versions = mock(NitriteCollection.class);
        when(db.getCollection("architectures")).thenReturn(headers);
        when(db.getCollection("architectureVersions")).thenReturn(versions);

        step = new NitriteArchitectureVersionSplitStep(db);
        stubCollectionContents(List.of());
    }

    /**
     * Models the step's two-pass read: a scan that keeps only ids, then a re-read of each
     * document by id. Resolving the second pass against the id rather than returning a
     * fixed document keeps per-document mistakes visible.
     */
    private void stubCollectionContents(List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(headers.find()).thenReturn(cursor);
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(headers.getById(any(NitriteId.class))).thenAnswer(invocation -> {
            NitriteId id = invocation.getArgument(0);
            return documents.stream()
                    .filter(document -> id.equals(document.getId()))
                    .findFirst()
                    .orElse(null);
        });
    }

    /** One old-shape namespace document holding one architecture with two versions. */
    private static Document oldNamespaceDocument() {
        return Document.createDocument()
                .put("namespace", "finos")
                .put("architectures", List.of(Document.createDocument()
                        .put("architectureId", 1)
                        .put("name", "Sample")
                        .put("description", "A description")
                        .put("versions", Document.createDocument()
                                .put("1-0-0", CONTENT_1_0_0)
                                .put("1-1-0", CONTENT_1_1_0))));
    }

    @Test
    void run_at_schema_version_two() {
        // Same version as the Mongo step. The two never coexist — each is gated on a
        // different calm.database.mode, so only one is ever a bean.
        assertThat(step.fromVersion(), is(2));
    }

    @Test
    void write_one_header_per_architecture_with_a_counted_version_total() {
        stubCollectionContents(List.of(oldNamespaceDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headers).insert(captor.capture());
        Document header = captor.getValue();
        assertThat(header.get("namespace", String.class), is("finos"));
        assertThat(header.get("architectureId", Integer.class), is(1));
        assertThat(header.get("name", String.class), is("Sample"));
        assertThat(header.get("versionCount", Integer.class), is(2));
    }

    @Test
    void write_one_version_document_per_stored_version_with_dot_separated_keys() {
        stubCollectionContents(List.of(oldNamespaceDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versions, times(2)).insert(captor.capture());
        assertThat(captor.getAllValues().stream().map(d -> d.get("version", String.class)).toList(),
                contains("1.0.0", "1.1.0"));
        // Content stays a JSON string in this backend rather than becoming a document.
        assertThat(captor.getAllValues().get(0).get("content", String.class), is(CONTENT_1_0_0));
    }

    @Test
    void remove_the_old_namespace_document_by_identity_not_by_filter() {
        Document oldDocument = oldNamespaceDocument();
        stubCollectionContents(List.of(oldDocument));

        step.apply();

        // The headers just written share this namespace, so a namespace-filtered delete
        // would take them with it.
        verify(headers).remove(oldDocument);
    }

    @Test
    void collapse_two_old_keys_that_mean_the_same_version_and_count_them_once() {
        // 1-0-0 and 100 are both accepted by VERSION_REGEX and both canonicalise to 1.0.0,
        // so the new shape can only store one of them.
        stubCollectionContents(List.of(Document.createDocument()
                .put("namespace", "finos")
                .put("architectures", List.of(Document.createDocument()
                        .put("architectureId", 1)
                        .put("versions", Document.createDocument()
                                .put("1-0-0", CONTENT_1_0_0)
                                .put("100", CONTENT_1_1_0))))));

        step.apply();

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        // First key wins rather than the last silently overwriting it.
        assertThat(versionCaptor.getValue().get("content", String.class), is(CONTENT_1_0_0));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headers).insert(headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("versionCount", Integer.class), is(1));
    }

    @Test
    void migrate_content_that_is_not_a_string_rather_than_aborting_the_run() {
        // The typed accessor would cast and throw out of the migration, aborting it with the
        // schema lock still held — the whole hub then refuses requests over one malformed
        // document. Carrying the value across unchanged keeps the run going and loses
        // nothing; the read path reports it as not found until it is repaired.
        stubCollectionContents(List.of(Document.createDocument()
                .put("namespace", "finos")
                .put("architectures", List.of(Document.createDocument()
                        .put("architectureId", 1)
                        .put("versions", Document.createDocument()
                                .put("1-0-0", 42))))));

        step.apply();

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        assertThat(versionCaptor.getValue().get("content"), is(42));
    }

    @Test
    void write_a_header_but_no_versions_for_an_architecture_that_has_none() {
        stubCollectionContents(List.of(Document.createDocument()
                .put("namespace", "finos")
                .put("architectures", List.of(Document.createDocument()
                        .put("architectureId", 9).put("name", "Empty")))));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headers).insert(captor.capture());
        assertThat(captor.getValue().get("versionCount", Integer.class), is(0));
        verify(versions, never()).insert(any(Document.class));
    }

    @Test
    void ignore_documents_that_are_already_headers() {
        // A header has no architectures array. This is what makes a re-run a no-op.
        stubCollectionContents(List.of(Document.createDocument()
                .put("namespace", "finos").put("architectureId", 1).put("versionCount", 2)));

        step.apply();

        verify(headers, never()).insert(any(Document.class));
        verify(headers, never()).remove(any(Document.class));
    }

    @Test
    void clear_any_partially_written_target_documents_before_inserting() {
        stubCollectionContents(List.of(oldNamespaceDocument()));

        step.apply();

        // Nitrite has no upsert, so a retried step would otherwise insert a second copy
        // of a header it already wrote — there is no unique index here to stop it.
        verify(headers).remove(any(Filter.class));
        verify(versions, times(2)).remove(any(Filter.class));
    }
}
