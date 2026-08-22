package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.exceptions.NitriteException;
import org.dizitart.no2.filters.Filter;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doCallRealMethod;

/**
 * Store-level tests for the header/version shape. Document mechanics are covered by
 * {@code TestNitriteVersionDocumentStoreShould}. Interface sets name/description
 * unconditionally on a version write and has no update path — both pinned here.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class TestNitriteInterfaceStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteCollection headerCollection;
    private NitriteCollection versionCollection;
    private NitriteInterfaceStore store;

    private static final String NAMESPACE = "finos";
    private static final int INTERFACE_ID = 42;
    private static final String VALID_JSON = "{\"test\": \"test\"}";

    @BeforeEach
    public void setup() throws NamespaceNotFoundException {
        doCallRealMethod().when(mockNamespaceStore).requireNamespace(anyString());
        headerCollection = mock(NitriteCollection.class);
        versionCollection = mock(NitriteCollection.class);

        when(mockDb.getCollection("interfaces")).thenReturn(headerCollection);
        when(mockDb.getCollection("interfaceVersions")).thenReturn(versionCollection);
        when(mockNamespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new NitriteInterfaceStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    private void stubFind(NitriteCollection collection, List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(collection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(collection.find()).thenReturn(cursor);
    }

    private void interfaceExists() {
        stubFind(headerCollection, List.of(Document.createDocument()
                .put("interfaceId", INTERFACE_ID).put("versionCount", 1)));
    }

    private void interfaceDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static CreateInterfaceRequest createRequest() {
        return new CreateInterfaceRequest("interface-name", "interface-description", VALID_JSON);
    }

    // --- getInterfacesForNamespace ---

    @Test
    public void throw_a_namespace_exception_when_listing_interfaces_for_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getInterfacesForNamespace(NAMESPACE));
    }

    @Test
    public void return_an_empty_list_when_a_namespace_has_no_interfaces() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getInterfacesForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    public void return_a_summary_per_header_document_without_a_version_count() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(
                Document.createDocument().put("interfaceId", 1).put("name", "First")
                        .put("description", "d1").put("versionCount", 2),
                Document.createDocument().put("interfaceId", 2).put("name", "Second")
                        .put("description", "d2").put("versionCount", 0)));

        assertThat(store.getInterfacesForNamespace(NAMESPACE), contains(
                new NamespaceInterfaceSummary("First", "d1", 1),
                new NamespaceInterfaceSummary("Second", "d2", 2)));
    }

    // --- createInterfaceForNamespace ---

    @Test
    public void reject_invalid_json_when_creating_a_interface() {
        CreateInterfaceRequest invalid = new CreateInterfaceRequest("n", "d", "{invalid json}");

        assertThrows(JsonParseException.class, () -> store.createInterfaceForNamespace(invalid, NAMESPACE));
        verify(headerCollection, org.mockito.Mockito.never()).insert(any(Document.class));
    }

    @Test
    public void create_a_header_and_an_initial_version() throws NamespaceNotFoundException {
        when(mockCounterStore.getNextInterfaceSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of(Document.createDocument()
                .put("interfaceId", 99).put("versionCount", 0)));
        stubFind(versionCollection, List.of());

        CalmInterface created = store.createInterfaceForNamespace(createRequest(), NAMESPACE);

        assertThat(created.getId(), is(99));
        assertThat(created.getVersion(), is("1.0.0"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        assertThat(versionCaptor.getValue().get("content", String.class), is(VALID_JSON));
    }

    @Test
    public void remove_the_header_again_when_the_first_version_write_fails() {
        when(mockCounterStore.getNextInterfaceSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of());
        stubFind(versionCollection, List.of());
        when(versionCollection.insert(any(Document.class)))
                .thenThrow(new NitriteException("store is closed"));

        assertThrows(NitriteException.class,
                () -> store.createInterfaceForNamespace(createRequest(), NAMESPACE));

        verify(headerCollection).remove(any(Filter.class));
    }

    @Test
    public void fail_rather_than_report_success_when_the_initial_version_already_exists() {
        when(mockCounterStore.getNextInterfaceSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of());
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.0")));

        assertThrows(StorageWriteException.class,
                () -> store.createInterfaceForNamespace(createRequest(), NAMESPACE));

        verify(headerCollection).remove(any(Filter.class));
    }

    // --- getInterfaceVersions / getInterfaceForVersion ---

    @Test
    public void throw_a_interface_exception_when_listing_versions_for_a_missing_interface() {
        interfaceDoesNotExist();

        assertThrows(InterfaceNotFoundException.class, () -> store.getInterfaceVersions(NAMESPACE, INTERFACE_ID));
    }

    @Test
    public void list_versions_in_semantic_order() throws NamespaceNotFoundException, InterfaceNotFoundException {
        interfaceExists();
        stubFind(versionCollection, List.of(
                Document.createDocument().put("version", "1.10.0"),
                Document.createDocument().put("version", "1.9.0"),
                Document.createDocument().put("version", "1.0.0")));

        assertThat(store.getInterfaceVersions(NAMESPACE, INTERFACE_ID), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    public void throw_a_version_exception_when_the_version_is_not_stored() {
        interfaceExists();
        stubFind(versionCollection, List.of());

        assertThrows(InterfaceVersionNotFoundException.class,
                () -> store.getInterfaceForVersion(NAMESPACE, INTERFACE_ID, "9.0.0"));
    }

    @Test
    public void return_the_content_of_a_stored_version() throws Exception {
        interfaceExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("content", VALID_JSON)));

        assertThat(store.getInterfaceForVersion(NAMESPACE, INTERFACE_ID, "1.0.0"), is(VALID_JSON));
    }

    // --- createInterfaceForVersion ---

    @Test
    public void throw_a_interface_exception_when_creating_a_version_for_a_missing_interface() {
        interfaceDoesNotExist();

        assertThrows(InterfaceNotFoundException.class,
                () -> store.createInterfaceForVersion(createRequest(), NAMESPACE, INTERFACE_ID, "1.0.1"));
    }

    @Test
    public void throw_a_version_exists_exception_when_the_version_is_already_stored() {
        interfaceExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.1")));

        assertThrows(InterfaceVersionExistsException.class,
                () -> store.createInterfaceForVersion(createRequest(), NAMESPACE, INTERFACE_ID, "1.0.1"));
    }

    @Test
    public void write_the_version_and_then_the_header_details() throws Exception {
        interfaceExists();
        stubFind(versionCollection, List.of());

        store.createInterfaceForVersion(createRequest(), NAMESPACE, INTERFACE_ID, "1.0.1");

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.1"));
        // Two header writes: the versionCount increment, then the name/description update.
        verify(headerCollection, times(2)).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void overwrite_the_header_details_even_when_blank() throws Exception {
        interfaceExists();
        stubFind(versionCollection, List.of());

        store.createInterfaceForVersion(new CreateInterfaceRequest(null, null, VALID_JSON),
                NAMESPACE, INTERFACE_ID, "1.0.1");

        // Unconditional, unlike Pattern and Flow — Interface's old shape did not guard these.
        verify(headerCollection, times(2)).update(any(Filter.class), any(Document.class));
    }
}
