package org.finos.calm.store.util;

import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
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

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
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
}
