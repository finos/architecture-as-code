package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.exceptions.NitriteException;
import org.dizitart.no2.filters.Filter;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.store.PageRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doCallRealMethod;

/**
 * Store-level tests for the header/version shape. Document mechanics are covered by
 * {@code TestNitriteVersionDocumentStoreShould}; what this class pins is the glue —
 * which domain exception each missing thing produces, the JSON validation this backend
 * does and Mongo doesn't, and the ordering between a version write and the header
 * details that accompany it.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class TestNitriteArchitectureStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteCollection headerCollection;
    private NitriteCollection versionCollection;
    private NitriteArchitectureStore store;

    private static final String NAMESPACE = "finos";
    private static final int ARCHITECTURE_ID = 42;
    private static final String VALID_JSON = "{\"test\": \"test\"}";
    private static final String ARCHITECTURE_NAME = "architecture-name";
    private static final String ARCHITECTURE_DESCRIPTION = "architecture description";

    @BeforeEach
    public void setup() throws NamespaceNotFoundException {
        doCallRealMethod().when(mockNamespaceStore).requireNamespace(anyString());
        headerCollection = mock(NitriteCollection.class);
        versionCollection = mock(NitriteCollection.class);

        when(mockDb.getCollection("architectures")).thenReturn(headerCollection);
        when(mockDb.getCollection("architectureVersions")).thenReturn(versionCollection);
        when(mockNamespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new NitriteArchitectureStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    private void stubFind(NitriteCollection collection, List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(collection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(collection.find()).thenReturn(cursor);
    }

    private void architectureExists() {
        stubFind(headerCollection, List.of(Document.createDocument()
                .put("architectureId", ARCHITECTURE_ID)
                .put("versionCount", 1)));
    }

    private void architectureDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static Architecture architecture(String version) {
        return new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(version)
                .setName(ARCHITECTURE_NAME)
                .setDescription(ARCHITECTURE_DESCRIPTION)
                .setArchitecture(VALID_JSON)
                .build();
    }

    // --- getArchitecturesForNamespace ---

    @Test
    public void throw_a_namespace_exception_when_listing_architectures_for_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getArchitecturesForNamespace(NAMESPACE));
    }

    @Test
    public void return_an_empty_list_when_a_namespace_has_no_architectures() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getArchitecturesForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    public void return_a_summary_per_header_document() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(
                Document.createDocument().put("architectureId", 1).put("name", "First")
                        .put("description", "d1").put("versionCount", 2),
                Document.createDocument().put("architectureId", 2).put("name", "Second")
                        .put("description", "d2").put("versionCount", 0)));

        assertThat(store.getArchitecturesForNamespace(NAMESPACE), contains(
                new NamespaceResourceSummary("First", "d1", 1, 2),
                new NamespaceResourceSummary("Second", "d2", 2, 0)));
    }

    @Test
    public void fall_back_to_a_generated_name_for_headers_missing_one() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(Document.createDocument().put("architectureId", 7)));

        assertThat(store.getArchitecturesForNamespace(NAMESPACE), contains(
                new NamespaceResourceSummary("Architecture 7", "", 7, 0)));
    }

    @Test
    public void apply_the_paging_window_in_memory() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(
                Document.createDocument().put("architectureId", 1).put("name", "First").put("versionCount", 1),
                Document.createDocument().put("architectureId", 2).put("name", "Second").put("versionCount", 1),
                Document.createDocument().put("architectureId", 3).put("name", "Third").put("versionCount", 1)));

        // Nitrite has no server-side skip/limit, so the window is applied after materialising.
        assertThat(store.getArchitecturesForNamespace(NAMESPACE, new PageRequest(1, 1)), contains(
                new NamespaceResourceSummary("Second", "", 2, 1)));
    }

    // --- createArchitectureForNamespace ---

    @Test
    public void throw_a_namespace_exception_when_creating_an_architecture_in_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createArchitectureForNamespace(architecture(null)));
    }

    @Test
    public void reject_invalid_json_when_creating_an_architecture() {
        Architecture invalid = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE).setArchitecture("{invalid json}").build();

        assertThrows(JsonParseException.class, () -> store.createArchitectureForNamespace(invalid));
        verify(headerCollection, never()).insert(any(Document.class));
    }

    @Test
    public void reject_null_json_when_creating_an_architecture() {
        Architecture noJson = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE).build();

        // This backend validates up front; Mongo would NPE inside Document.parse instead.
        assertThrows(JsonParseException.class, () -> store.createArchitectureForNamespace(noJson));
    }

    @Test
    public void create_a_header_and_an_initial_version() throws NamespaceNotFoundException {
        when(mockCounterStore.getNextArchitectureSequenceValue()).thenReturn(99);
        // The header the insert below creates, so the count increment that follows the
        // version write finds something to increment.
        stubFind(headerCollection, List.of(Document.createDocument()
                .put("architectureId", 99).put("versionCount", 0)));
        stubFind(versionCollection, List.of());

        Architecture created = store.createArchitectureForNamespace(architecture(null));

        assertThat(created.getId(), is(99));
        assertThat(created.getDotVersion(), is("1.0.0"));
        // Unlike the Mongo store, this one echoes name/description back on the created
        // object. Long-standing difference between the two, preserved deliberately.
        assertThat(created.getName(), is(ARCHITECTURE_NAME));
        assertThat(created.getDescription(), is(ARCHITECTURE_DESCRIPTION));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).insert(headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("architectureId", Integer.class), is(99));
        assertThat(headerCaptor.getValue().get("versionCount", Integer.class), is(0));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        // Content stays a JSON string in this backend rather than a parsed document.
        assertThat(versionCaptor.getValue().get("content", String.class), is(VALID_JSON));
    }

    @Test
    public void remove_the_header_again_when_the_first_version_write_fails() {
        when(mockCounterStore.getNextArchitectureSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of());
        stubFind(versionCollection, List.of());
        when(versionCollection.insert(any(Document.class)))
                .thenThrow(new NitriteException("store is closed"));

        // Matches the Mongo store: a header with no versions cannot be removed through the
        // API, so a failed first version write must not leave one behind.
        assertThrows(NitriteException.class,
                () -> store.createArchitectureForNamespace(architecture(null)));

        verify(headerCollection).remove(any(Filter.class));
    }

    @Test
    public void fail_rather_than_report_success_when_the_initial_version_already_exists() {
        when(mockCounterStore.getNextArchitectureSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of());
        // A version document already present for a freshly allocated id.
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.0")));

        assertThrows(StorageWriteException.class,
                () -> store.createArchitectureForNamespace(architecture(null)));

        verify(headerCollection).remove(any(Filter.class));
    }

    // --- getArchitectureVersions ---

    @Test
    public void throw_a_namespace_exception_when_listing_versions_for_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getArchitectureVersions(architecture(null)));
    }

    @Test
    public void throw_an_architecture_exception_when_listing_versions_for_a_missing_architecture() {
        architectureDoesNotExist();

        assertThrows(ArchitectureNotFoundException.class, () -> store.getArchitectureVersions(architecture(null)));
    }

    @Test
    public void list_versions_in_semantic_order() throws NamespaceNotFoundException, ArchitectureNotFoundException {
        architectureExists();
        stubFind(versionCollection, List.of(
                Document.createDocument().put("version", "1.10.0"),
                Document.createDocument().put("version", "1.9.0"),
                Document.createDocument().put("version", "1.0.0")));

        assertThat(store.getArchitectureVersions(architecture(null)), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    public void return_no_versions_rather_than_not_found_for_an_architecture_with_none() throws NamespaceNotFoundException, ArchitectureNotFoundException {
        architectureExists();
        stubFind(versionCollection, List.of());

        // ADR 0003: the header proves existence, so an empty version list is an answer
        // rather than evidence of a missing architecture.
        assertThat(store.getArchitectureVersions(architecture(null)), is(empty()));
    }

    // --- getArchitectureForVersion ---

    @Test
    public void throw_a_namespace_exception_when_getting_a_version_from_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getArchitectureForVersion(architecture("1.0.0")));
    }

    @Test
    public void throw_an_architecture_exception_when_getting_a_version_of_a_missing_architecture() {
        architectureDoesNotExist();

        assertThrows(ArchitectureNotFoundException.class, () -> store.getArchitectureForVersion(architecture("1.0.0")));
    }

    @Test
    public void throw_a_version_exception_when_the_version_is_not_stored() {
        architectureExists();
        stubFind(versionCollection, List.of());

        assertThrows(ArchitectureVersionNotFoundException.class,
                () -> store.getArchitectureForVersion(architecture("9.0.0")));
    }

    @Test
    public void return_the_content_of_a_stored_version() throws Exception {
        architectureExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("content", VALID_JSON)));

        assertThat(store.getArchitectureForVersion(architecture("1.0.0")), is(VALID_JSON));
    }

    // --- createArchitectureForVersion ---

    @Test
    public void throw_a_namespace_exception_when_creating_a_version_in_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    public void reject_invalid_json_before_checking_the_architecture_exists() {
        architectureDoesNotExist();
        Architecture invalid = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE).setId(ARCHITECTURE_ID).setVersion("1.0.1")
                .setArchitecture("{invalid json}").build();

        // Deliberate divergence from Mongo, which reports the missing architecture first.
        // Pinned so the ordering is a decision rather than an accident.
        assertThrows(JsonParseException.class, () -> store.createArchitectureForVersion(invalid));
    }

    @Test
    public void throw_an_architecture_exception_when_creating_a_version_for_a_missing_architecture() {
        architectureDoesNotExist();

        assertThrows(ArchitectureNotFoundException.class,
                () -> store.createArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    public void throw_a_version_exists_exception_when_the_version_is_already_stored() {
        architectureExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.1")));

        assertThrows(ArchitectureVersionExistsException.class,
                () -> store.createArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    public void not_rename_the_architecture_when_the_version_already_exists() {
        architectureExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.1")));

        assertThrows(ArchitectureVersionExistsException.class,
                () -> store.createArchitectureForVersion(architecture("1.0.1")));

        // A rejected create must leave name/description untouched, as the old single
        // atomic update did.
        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void write_the_version_and_then_the_header_details() throws Exception {
        architectureExists();
        stubFind(versionCollection, List.of());

        store.createArchitectureForVersion(architecture("1.0.1"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.1"));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        // Two header writes: the versionCount increment, then the name/description update.
        verify(headerCollection, org.mockito.Mockito.times(2)).update(any(Filter.class), headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("name", String.class), is(ARCHITECTURE_NAME));
    }

    // --- updateArchitectureForVersion ---

    @Test
    public void throw_a_namespace_exception_when_updating_a_version_in_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.updateArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    public void throw_an_architecture_exception_when_updating_a_version_for_a_missing_architecture() {
        architectureDoesNotExist();

        assertThrows(ArchitectureNotFoundException.class,
                () -> store.updateArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    public void replace_the_content_of_an_existing_version_on_update() throws Exception {
        architectureExists();
        stubFind(versionCollection, List.of(Document.createDocument()
                .put("version", "1.0.1").put("content", "{\"old\":true}")));

        store.updateArchitectureForVersion(architecture("1.0.1"));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).update(any(Filter.class), captor.capture());
        assertThat(captor.getValue().get("content", String.class), is(VALID_JSON));
        // Replacing doesn't move the count, so the only header write is the details update.
        verify(headerCollection).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void create_the_version_when_updating_one_that_does_not_exist() throws Exception {
        architectureExists();
        stubFind(versionCollection, List.of());

        // Preserves the known create-on-PUT behaviour (bugs.md #1) rather than changing it.
        store.updateArchitectureForVersion(architecture("2.0.0"));

        verify(versionCollection).insert(any(Document.class));
    }
}
