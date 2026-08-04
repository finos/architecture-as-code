package org.finos.calm.store.util;

import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.exceptions.NitriteException;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import org.finos.calm.domain.exception.StorageWriteException;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestNitriteVersionDocumentStoreShould {

    private static final String NAMESPACE = "finos";
    private static final int RESOURCE_ID = 42;
    private static final String ID_FIELD = "architectureId";
    private static final String LABEL = "Architecture";
    private static final String CONTENT = "{\"title\":\"My Architecture\"}";

    private NitriteCollection headerCollection;
    private NitriteCollection versionCollection;
    private NitriteVersionDocumentStore store;

    @BeforeEach
    void setup() {
        headerCollection = mock(NitriteCollection.class);
        versionCollection = mock(NitriteCollection.class);
        store = new NitriteVersionDocumentStore(headerCollection, versionCollection, ID_FIELD, LABEL);
    }

    /** Stubs find(...) to return a cursor over the given documents. */
    private void stubFind(NitriteCollection collection, List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(collection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(collection.find()).thenReturn(cursor);
    }

    private static Document header(Integer id, String name, String description, Integer versionCount) {
        Document header = Document.createDocument().put(ID_FIELD, id);
        if (name != null) header.put("name", name);
        if (description != null) header.put("description", description);
        if (versionCount != null) header.put("versionCount", versionCount);
        return header;
    }

    private static Document versionDocument(String version) {
        return Document.createDocument().put("version", version);
    }

    // --- headerExists ---

    @Test
    void report_a_resource_exists_when_its_header_is_present() {
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "name", "description", 1)));

        assertThat(store.headerExists(NAMESPACE, RESOURCE_ID), is(true));
    }

    @Test
    void report_a_resource_does_not_exist_when_no_header_is_present() {
        stubFind(headerCollection, List.of());

        assertThat(store.headerExists(NAMESPACE, RESOURCE_ID), is(false));
    }

    // --- createHeader ---

    @Test
    void create_a_header_with_a_zero_version_count_and_empty_metadata() {
        store.createHeader(NAMESPACE, RESOURCE_ID, "My Architecture", "A description");

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).insert(captor.capture());
        Document inserted = captor.getValue();
        assertThat(inserted.get("namespace", String.class), is(NAMESPACE));
        assertThat(inserted.get(ID_FIELD, Integer.class), is(RESOURCE_ID));
        assertThat(inserted.get("name", String.class), is("My Architecture"));
        assertThat(inserted.get("description", String.class), is("A description"));
        assertThat(inserted.get("versionCount", Integer.class), is(0));
        assertThat(inserted.get("metadata", Document.class), is(Document.createDocument()));
    }

    // --- deleteHeader ---

    @Test
    void delete_a_header_by_namespace_and_id() {
        store.deleteHeader(NAMESPACE, RESOURCE_ID);

        verify(headerCollection).remove(any(Filter.class));
    }

    @Test
    void swallow_a_failure_to_delete_a_header() {
        when(headerCollection.remove(any(Filter.class))).thenThrow(new NitriteException("store is closed"));

        // Matches the Mongo helper: the caller is already failing a create.
        assertDoesNotThrow(() -> store.deleteHeader(NAMESPACE, RESOURCE_ID));
    }

    // --- createVersion ---

    @Test
    void create_a_version_and_increment_the_header_count() {
        stubFind(versionCollection, List.of());
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "name", "description", 1)));

        boolean created = store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", CONTENT);

        assertThat(created, is(true));
        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(captor.capture());
        assertThat(captor.getValue().get("version", String.class), is("1.0.0"));
        assertThat(captor.getValue().get("content", String.class), is(CONTENT));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).update(any(Filter.class), headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("versionCount", Integer.class), is(2));
    }

    @Test
    void report_a_version_already_exists_rather_than_overwriting_it() {
        // Nitrite has no unique index to reject this, so the check happens here — see the
        // class javadoc on why holding the write lock across check-then-insert is safe.
        stubFind(versionCollection, List.of(versionDocument("1.0.0")));

        boolean created = store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", CONTENT);

        assertThat(created, is(false));
        verify(versionCollection, never()).insert(any(Document.class));
        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }

    @Test
    void store_a_dash_spelled_version_under_its_canonical_form() {
        stubFind(versionCollection, List.of());
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "name", "description", 1)));

        // Both spellings are accepted by VERSION_REGEX. It matters more here than in the
        // Mongo helper: Nitrite has no unique index at all, so an uncanonicalised spelling
        // would sail past the check-then-insert and become a second document silently.
        store.createVersion(NAMESPACE, RESOURCE_ID, "1-0-0", CONTENT);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(captor.capture());
        assertThat(captor.getValue().get("version", String.class), is("1.0.0"));
    }

    @Test
    void treat_a_missing_version_count_as_zero_when_incrementing() {
        stubFind(versionCollection, List.of());
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "name", "description", null)));

        store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", CONTENT);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).update(any(Filter.class), captor.capture());
        assertThat(captor.getValue().get("versionCount", Integer.class), is(1));
    }

    @Test
    void warn_but_still_succeed_when_a_version_has_no_header_to_count_it() {
        stubFind(versionCollection, List.of());
        stubFind(headerCollection, List.of());

        // The version content is already stored, so an orphaned count is not worth failing over.
        assertThat(store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", CONTENT), is(true));
        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }

    @Test
    void still_succeed_when_the_count_update_itself_fails_after_creating_a_version() {
        stubFind(versionCollection, List.of());
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "name", "description", 1)));
        when(headerCollection.update(any(Filter.class), any(Document.class)))
                .thenThrow(new NitriteException("store is closed"));

        // Matches the Mongo helper: the version is stored, so a failed count write must
        // not report failure for a write that succeeded (ADR 0003).
        assertThat(store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", CONTENT), is(true));
        verify(versionCollection).insert(any(Document.class));
    }

    // --- createFirstVersion ---

    @Test
    void create_the_first_version_of_a_new_resource() {
        stubFind(versionCollection, List.of());
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "name", "description", 0)));

        store.createFirstVersion(NAMESPACE, RESOURCE_ID, CONTENT);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(captor.capture());
        assertThat(captor.getValue().get("version", String.class), is("1.0.0"));
        verify(headerCollection, never()).remove(any(Filter.class));
    }

    @Test
    void remove_the_header_again_when_the_first_version_write_fails() {
        stubFind(versionCollection, List.of());
        when(versionCollection.insert(any(Document.class))).thenThrow(new NitriteException("store is closed"));

        // Matches the Mongo helper: no endpoint can delete a header, so one stranded by a
        // failed first version write would stay visible with versionCount 0 forever.
        assertThrows(NitriteException.class,
                () -> store.createFirstVersion(NAMESPACE, RESOURCE_ID, CONTENT));

        verify(headerCollection).remove(any(Filter.class));
    }

    @Test
    void fail_rather_than_report_success_when_the_first_version_already_exists() {
        stubFind(versionCollection, List.of(versionDocument("1.0.0")));

        // For an id the counter has just issued this is a storage inconsistency rather than
        // a normal conflict, and reporting success would return 201 for unstored content.
        assertThrows(StorageWriteException.class,
                () -> store.createFirstVersion(NAMESPACE, RESOURCE_ID, CONTENT));

        verify(headerCollection).remove(any(Filter.class));
    }

    // --- upsertVersion ---

    @Test
    void insert_and_increment_when_upserting_a_version_that_does_not_exist() {
        stubFind(versionCollection, List.of());
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "name", "description", 1)));

        store.upsertVersion(NAMESPACE, RESOURCE_ID, "2.0.0", CONTENT);

        verify(versionCollection).insert(any(Document.class));
        verify(headerCollection).update(any(Filter.class), any(Document.class));
    }

    @Test
    void store_the_canonical_form_when_an_upsert_inserts_a_dash_spelled_version() {
        stubFind(versionCollection, List.of());
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "name", "description", 1)));

        store.upsertVersion(NAMESPACE, RESOURCE_ID, "2-0-0", CONTENT);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(captor.capture());
        assertThat(captor.getValue().get("version", String.class), is("2.0.0"));
    }

    @Test
    void replace_content_but_preserve_metadata_when_upserting_an_existing_version() {
        Document existing = Document.createDocument()
                .put("version", "1.0.0")
                .put("content", "{\"old\":true}")
                .put("metadata", Document.createDocument().put("status", "ARCHIVED"));
        stubFind(versionCollection, List.of(existing));

        store.upsertVersion(NAMESPACE, RESOURCE_ID, "1.0.0", CONTENT);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).update(any(Filter.class), captor.capture());
        Document written = captor.getValue();
        assertThat(written.get("content", String.class), is(CONTENT));
        // Overwriting wholesale would silently discard an archived marker.
        assertThat(written.get("metadata", Document.class).get("status", String.class), is("ARCHIVED"));
        verify(versionCollection, never()).insert(any(Document.class));
    }

    @Test
    void not_increment_the_version_count_when_an_upsert_replaces_an_existing_version() {
        stubFind(versionCollection, List.of(versionDocument("1.0.0")));

        store.upsertVersion(NAMESPACE, RESOURCE_ID, "1.0.0", CONTENT);

        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }

    // --- updateHeaderDetails ---

    @Test
    void overwrite_the_headers_name_and_description() {
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "Old name", "Old description", 2)));

        store.updateHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "A new description");

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).update(any(Filter.class), captor.capture());
        assertThat(captor.getValue().get("name", String.class), is("Renamed"));
        assertThat(captor.getValue().get("description", String.class), is("A new description"));
        // The count must survive a rename — it lives on the same document.
        assertThat(captor.getValue().get("versionCount", Integer.class), is(2));
    }

    @Test
    void let_a_null_name_overwrite_a_stored_one() {
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "Old name", "Old description", 1)));

        // Faithful to the old shape: a version write carrying no name wipes the display
        // name. Known bug, preserved deliberately rather than fixed during a port.
        store.updateHeaderDetails(NAMESPACE, RESOURCE_ID, null, null);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).update(any(Filter.class), captor.capture());
        assertThat(captor.getValue().get("name", String.class), is(nullValue()));
    }

    @Test
    void warn_rather_than_throw_when_there_is_no_header_to_update_details_on() {
        stubFind(headerCollection, List.of());

        store.updateHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "d");

        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }

    // --- updatePresentHeaderDetails ---

    @Test
    void update_only_the_header_details_that_are_present() {
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "Old name", "Old description", 2)));

        store.updatePresentHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "   ");

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).update(any(Filter.class), captor.capture());
        assertThat(captor.getValue().get("name", String.class), is("Renamed"));
        // A blank description leaves the stored one alone.
        assertThat(captor.getValue().get("description", String.class), is("Old description"));
    }

    @Test
    void write_nothing_when_no_header_details_are_present() {
        store.updatePresentHeaderDetails(NAMESPACE, RESOURCE_ID, null, "");

        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }

    @Test
    void warn_rather_than_throw_when_there_is_no_header_to_update_present_details_on() {
        stubFind(headerCollection, List.of());

        store.updatePresentHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "d");

        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }

    // --- getVersion ---

    @Test
    void return_the_content_of_a_stored_version() {
        stubFind(versionCollection, List.of(versionDocument("1.0.0").put("content", CONTENT)));

        assertThat(store.getVersion(NAMESPACE, RESOURCE_ID, "1.0.0"), is(CONTENT));
    }

    @Test
    void return_null_when_a_version_is_not_stored() {
        stubFind(versionCollection, List.of());

        assertThat(store.getVersion(NAMESPACE, RESOURCE_ID, "9.9.9"), is(nullValue()));
    }

    @Test
    void treat_content_that_is_not_a_string_as_a_version_that_cannot_be_read() {
        // Nitrite's typed accessor casts rather than returning null, so a document whose
        // content is not a String would throw out of the store and surface as a 500. The
        // per-type stores guarded this with instanceof and returned not-found, giving a
        // 404; reachable from a hand-repaired database or odd pre-migration data.
        stubFind(versionCollection, List.of(versionDocument("1.0.0").put("content", 42)));

        assertThat(store.getVersion(NAMESPACE, RESOURCE_ID, "1.0.0"), is(nullValue()));
    }

    // --- listVersions ---

    @Test
    void list_versions_in_semantic_order_rather_than_stored_order() {
        stubFind(versionCollection, List.of(
                versionDocument("1.10.0"), versionDocument("1.9.0"), versionDocument("1.0.0")));

        assertThat(store.listVersions(NAMESPACE, RESOURCE_ID), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    void return_no_versions_for_a_resource_that_has_none() {
        stubFind(versionCollection, List.of());

        // Empty means "no versions", never "no such resource" — that's headerExists' job.
        assertThat(store.listVersions(NAMESPACE, RESOURCE_ID), is(empty()));
    }

    // --- getLatestVersion / getLatestVersionContent ---

    @Test
    void resolve_the_latest_version_by_the_stores_own_ordering() {
        stubFind(versionCollection, List.of(versionDocument("1.10.0"), versionDocument("1.9.0")));

        assertThat(store.getLatestVersion(NAMESPACE, RESOURCE_ID), is("1.10.0"));
    }

    @Test
    void store_a_numeric_revision_verbatim_rather_than_canonicalising_it() {
        NitriteVersionDocumentStore numericStore = new NitriteVersionDocumentStore(
                headerCollection, versionCollection, ID_FIELD, LABEL, VersionScheme.NUMERIC);
        stubFind(versionCollection, List.of());
        stubFind(headerCollection, List.of(header(RESOURCE_ID, "name", "description", 0)));

        // See the Mongo twin: "100" is an accepted spelling of 1.0.0, so canonicalising ADR
        // revisions rewrites revision 100 and makes it sort below 99.
        numericStore.createVersion(NAMESPACE, RESOURCE_ID, "100", CONTENT);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(captor.capture());
        assertThat(captor.getValue().get("version", String.class), is("100"));
    }

    @Test
    void resolve_the_latest_version_numerically_when_told_to() {
        NitriteVersionDocumentStore numericStore = new NitriteVersionDocumentStore(
                headerCollection, versionCollection, ID_FIELD, LABEL, VersionScheme.NUMERIC);
        stubFind(versionCollection, List.of(versionDocument("2"), versionDocument("10")));

        assertThat(numericStore.getLatestVersion(NAMESPACE, RESOURCE_ID), is("10"));
    }

    @Test
    void return_no_latest_version_for_a_resource_with_none() {
        stubFind(versionCollection, List.of());

        assertThat(store.getLatestVersion(NAMESPACE, RESOURCE_ID), is(nullValue()));
    }

    @Test
    void return_the_content_of_the_latest_version() {
        stubFind(versionCollection, List.of(versionDocument("2.0.0").put("content", CONTENT)));

        assertThat(store.getLatestVersionContent(NAMESPACE, RESOURCE_ID), is(CONTENT));
    }

    @Test
    void return_no_latest_content_for_a_resource_with_no_versions() {
        stubFind(versionCollection, List.of());

        assertThat(store.getLatestVersionContent(NAMESPACE, RESOURCE_ID), is(nullValue()));
    }

    // --- listSummariesPaged ---

    @Test
    void list_summaries_for_a_namespace_ordered_by_id() {
        stubFind(headerCollection, List.of(
                header(2, "Second", "Second description", 0),
                header(1, "First", "First description", 2)));

        assertThat(store.listSummariesPaged(NAMESPACE, PageRequest.UNPAGED), contains(
                new NamespaceResourceSummary("First", "First description", 1, 2),
                new NamespaceResourceSummary("Second", "Second description", 2, 0)));
    }

    @Test
    void apply_the_paging_window_in_memory() {
        // Nitrite has no server-side skip/limit, so the window is applied after materialising.
        stubFind(headerCollection, List.of(
                header(1, "First", "d", 1),
                header(2, "Second", "d", 1),
                header(3, "Third", "d", 1)));

        assertThat(store.listSummariesPaged(NAMESPACE, new PageRequest(1, 1)),
                contains(new NamespaceResourceSummary("Second", "d", 2, 1)));
    }

    @Test
    void fall_back_to_a_generated_name_and_blank_description_when_a_header_has_neither() {
        // Headers migrated from the old shape can lack both, which must not produce nulls.
        stubFind(headerCollection, List.of(header(7, null, null, null)));

        assertThat(store.listSummariesPaged(NAMESPACE, PageRequest.UNPAGED),
                contains(new NamespaceResourceSummary("Architecture 7", "", 7, 0)));
    }

    @Test
    void sort_headers_that_have_no_id_last_rather_than_failing_the_listing() {
        // Comparing ids with Integer.compare unboxes, so a single id-less header would NPE
        // the whole namespace listing into a 500 — where Mongo, which sorts database-side,
        // returns 200 with the row included. The backends have to agree.
        stubFind(headerCollection, List.of(
                header(null, "No id", "d", 0),
                header(1, "First", "d", 1)));

        assertThat(store.listSummariesPaged(NAMESPACE, PageRequest.UNPAGED), contains(
                new NamespaceResourceSummary("First", "d", 1, 1),
                new NamespaceResourceSummary("No id", "d", null, 0)));
    }
}
