package org.finos.calm.migration.steps;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
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
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NitriteDB counterpart to {@code TestMongoAdrTitleBackfillStepShould}. See
 * {@code calm-hub/decisions/0006-denormalize-adr-title-onto-header.md}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestNitriteAdrTitleBackfillStepShould {

    private NitriteCollection headerCollection;
    private NitriteCollection versionCollection;
    private NitriteAdrTitleBackfillStep step;

    @BeforeEach
    void setup() {
        Nitrite db = mock(Nitrite.class);
        headerCollection = mock(NitriteCollection.class);
        versionCollection = mock(NitriteCollection.class);
        when(db.getCollection("adrs")).thenReturn(headerCollection);
        when(db.getCollection("adrVersions")).thenReturn(versionCollection);

        step = new NitriteAdrTitleBackfillStep(db);
    }

    private void stubHeaders(List<Document> headers) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(headerCollection.find()).thenReturn(cursor);
        when(cursor.iterator()).thenAnswer(invocation -> headers.iterator());
    }

    /** Revision documents as listVersions sees them, plus the content getVersion returns. */
    private void stubRevisions(List<String> revisions, String latestContent) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(versionCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(
                latestContent == null ? null : Document.createDocument().put("content", latestContent));
        when(cursor.iterator()).thenAnswer(invocation ->
                revisions.stream().map(r -> Document.createDocument().put("version", r)).iterator());
    }

    /** The header lookup {@code updatePresentHeaderDetails} performs before writing. */
    private void stubHeaderLookup(Document header) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(headerCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(header);
    }

    @Test
    void run_at_schema_version_ten() {
        // Matches the Mongo step's version. The two never coexist — each is gated on a
        // different calm.database.mode.
        assertThat(step.fromVersion(), is(10));
    }

    @Test
    void apply_delegates_to_backfill() {
        stubHeaders(List.of());

        step.apply();

        verify(headerCollection).find();
    }

    @Test
    void default_to_untitled_adr_when_the_latest_revision_content_is_not_readable_json() throws Exception {
        Document header = Document.createDocument().put("namespace", "finos").put("adrId", 1);
        stubHeaders(List.of(header));
        stubHeaderLookup(header);
        stubRevisions(List.of("1"), "{not valid json");

        step.backfill();

        ArgumentCaptor<Document> updateCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).update(any(Filter.class), updateCaptor.capture());
        assertThat(updateCaptor.getValue().get("name", String.class), is("Untitled ADR"));
    }

    @Test
    void skip_a_header_that_already_has_a_title() {
        stubHeaders(List.of(Document.createDocument()
                .put("namespace", "finos").put("adrId", 1).put("name", "Already Titled")));

        step.backfill();

        verify(headerCollection, never()).find(any(Filter.class));
    }

    @Test
    void write_the_resolved_title_onto_an_untitled_header() throws Exception {
        Document header = Document.createDocument().put("namespace", "finos").put("adrId", 1);
        stubHeaders(List.of(header));
        stubHeaderLookup(header);
        stubRevisions(List.of("1"), "{\"title\": \"Resolved Title\"}");

        step.backfill();

        ArgumentCaptor<Document> updateCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).update(any(Filter.class), updateCaptor.capture());
        assertThat(updateCaptor.getValue().get("name", String.class), is("Resolved Title"));
    }

    @Test
    void default_to_untitled_adr_when_the_latest_revision_has_no_title() throws Exception {
        Document header = Document.createDocument().put("namespace", "finos").put("adrId", 1);
        stubHeaders(List.of(header));
        stubHeaderLookup(header);
        stubRevisions(List.of("1"), "{\"status\": \"draft\"}");

        step.backfill();

        ArgumentCaptor<Document> updateCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).update(any(Filter.class), updateCaptor.capture());
        assertThat(updateCaptor.getValue().get("name", String.class), is("Untitled ADR"));
    }

    @Test
    void default_to_untitled_adr_when_there_is_no_readable_revision() throws Exception {
        Document header = Document.createDocument().put("namespace", "finos").put("adrId", 1);
        stubHeaders(List.of(header));
        stubHeaderLookup(header);
        stubRevisions(List.of(), null);

        step.backfill();

        ArgumentCaptor<Document> updateCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).update(any(Filter.class), updateCaptor.capture());
        assertThat(updateCaptor.getValue().get("name", String.class), is("Untitled ADR"));
    }

    @Test
    void skip_a_malformed_header_with_no_namespace_or_adr_id() {
        stubHeaders(List.of(Document.createDocument().put("adrId", 1)));

        step.backfill();

        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }
}
