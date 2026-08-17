package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.exceptions.NitriteException;
import org.dizitart.no2.filters.Filter;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doCallRealMethod;

/**
 * Store-level tests for the header/version shape. Document mechanics are covered by
 * {@code TestNitriteVersionDocumentStoreShould}; what this class pins is the glue — the
 * domain exceptions, the JSON validation this backend does and Mongo doesn't, and Flow's
 * blank-guarding of name/description.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class TestNitriteFlowStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteCollection headerCollection;
    private NitriteCollection versionCollection;
    private NitriteFlowStore store;

    private static final String NAMESPACE = "finos";
    private static final int FLOW_ID = 42;
    private static final String VALID_JSON = "{\"test\": \"test\"}";
    private static final String FLOW_NAME = "flow-name";
    private static final String FLOW_DESCRIPTION = "flow description";

    @BeforeEach
    public void setup() throws NamespaceNotFoundException {
        doCallRealMethod().when(mockNamespaceStore).requireNamespace(anyString());
        headerCollection = mock(NitriteCollection.class);
        versionCollection = mock(NitriteCollection.class);

        when(mockDb.getCollection("flows")).thenReturn(headerCollection);
        when(mockDb.getCollection("flowVersions")).thenReturn(versionCollection);
        when(mockNamespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new NitriteFlowStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    private void stubFind(NitriteCollection collection, List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(collection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(collection.find()).thenReturn(cursor);
    }

    private void flowExists() {
        stubFind(headerCollection, List.of(Document.createDocument()
                .put("flowId", FLOW_ID)
                .put("versionCount", 1)));
    }

    private void flowDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static Flow flow(String version, String name, String description) {
        return new Flow.FlowBuilder()
                .setNamespace(NAMESPACE)
                .setId(FLOW_ID)
                .setVersion(version)
                .setName(name)
                .setDescription(description)
                .setFlow(VALID_JSON)
                .build();
    }

    private static Flow flow(String version) {
        return flow(version, FLOW_NAME, FLOW_DESCRIPTION);
    }

    private static CreateFlowRequest createRequest() {
        return new CreateFlowRequest(FLOW_NAME, FLOW_DESCRIPTION, VALID_JSON);
    }

    // --- getFlowsForNamespace ---

    @Test
    public void throw_a_namespace_exception_when_listing_flows_for_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getFlowsForNamespace(NAMESPACE));
    }

    @Test
    public void return_an_empty_list_when_a_namespace_has_no_flows() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getFlowsForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    public void return_a_summary_per_header_document() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(
                Document.createDocument().put("flowId", 1).put("name", "First")
                        .put("description", "d1").put("versionCount", 2),
                Document.createDocument().put("flowId", 2).put("name", "Second")
                        .put("description", "d2").put("versionCount", 0)));

        assertThat(store.getFlowsForNamespace(NAMESPACE), contains(
                new NamespaceResourceSummary("First", "d1", 1, 2),
                new NamespaceResourceSummary("Second", "d2", 2, 0)));
    }

    @Test
    public void fall_back_to_a_generated_name_for_headers_missing_one() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(Document.createDocument().put("flowId", 7)));

        assertThat(store.getFlowsForNamespace(NAMESPACE), contains(
                new NamespaceResourceSummary("Flow 7", "", 7, 0)));
    }


    // --- createFlowForNamespace ---

    @Test
    public void throw_a_namespace_exception_when_creating_a_flow_in_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createFlowForNamespace(createRequest(), NAMESPACE));
    }

    @Test
    public void reject_invalid_json_when_creating_a_flow() {
        CreateFlowRequest invalid = new CreateFlowRequest("n", "d", "{invalid json}");

        assertThrows(JsonParseException.class, () -> store.createFlowForNamespace(invalid, NAMESPACE));
        verify(headerCollection, never()).insert(any(Document.class));
    }

    @Test
    public void reject_null_json_when_creating_a_flow() {
        CreateFlowRequest noJson = new CreateFlowRequest("n", "d", null);

        // This backend validates up front; Mongo would NPE inside Document.parse instead.
        assertThrows(JsonParseException.class, () -> store.createFlowForNamespace(noJson, NAMESPACE));
    }

    @Test
    public void create_a_header_and_an_initial_version() throws NamespaceNotFoundException {
        when(mockCounterStore.getNextFlowSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of(Document.createDocument()
                .put("flowId", 99).put("versionCount", 0)));
        stubFind(versionCollection, List.of());

        Flow created = store.createFlowForNamespace(createRequest(), NAMESPACE);

        assertThat(created.getId(), is(99));
        // Was "1-0-0" before this port, so the Location header differed by backend for the
        // same operation. Now dot-separated on both, matching what is actually stored.
        assertThat(created.getDotVersion(), is("1.0.0"));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).insert(headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("flowId", Integer.class), is(99));
        assertThat(headerCaptor.getValue().get("versionCount", Integer.class), is(0));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        // Content stays a JSON string in this backend rather than a parsed document.
        assertThat(versionCaptor.getValue().get("content", String.class), is(VALID_JSON));
    }

    @Test
    public void remove_the_header_again_when_the_first_version_write_fails() {
        when(mockCounterStore.getNextFlowSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of());
        stubFind(versionCollection, List.of());
        when(versionCollection.insert(any(Document.class)))
                .thenThrow(new NitriteException("store is closed"));

        assertThrows(NitriteException.class,
                () -> store.createFlowForNamespace(createRequest(), NAMESPACE));

        verify(headerCollection).remove(any(Filter.class));
    }

    @Test
    public void fail_rather_than_report_success_when_the_initial_version_already_exists() {
        when(mockCounterStore.getNextFlowSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of());
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.0")));

        assertThrows(StorageWriteException.class,
                () -> store.createFlowForNamespace(createRequest(), NAMESPACE));

        verify(headerCollection).remove(any(Filter.class));
    }

    // --- getFlowVersions ---

    @Test
    public void throw_a_flow_exception_when_listing_versions_for_a_missing_flow() {
        flowDoesNotExist();

        assertThrows(FlowNotFoundException.class, () -> store.getFlowVersions(flow(null)));
    }

    @Test
    public void list_versions_in_semantic_order() throws NamespaceNotFoundException, FlowNotFoundException {
        flowExists();
        stubFind(versionCollection, List.of(
                Document.createDocument().put("version", "1.10.0"),
                Document.createDocument().put("version", "1.9.0"),
                Document.createDocument().put("version", "1.0.0")));

        assertThat(store.getFlowVersions(flow(null)), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    public void return_no_versions_rather_than_not_found_for_a_flow_with_none() throws NamespaceNotFoundException, FlowNotFoundException {
        flowExists();
        stubFind(versionCollection, List.of());

        assertThat(store.getFlowVersions(flow(null)), is(empty()));
    }

    // --- getFlowForVersion ---

    @Test
    public void throw_a_flow_exception_when_getting_a_version_of_a_missing_flow() {
        flowDoesNotExist();

        assertThrows(FlowNotFoundException.class, () -> store.getFlowForVersion(flow("1.0.0")));
    }

    @Test
    public void throw_a_version_exception_when_the_version_is_not_stored() {
        flowExists();
        stubFind(versionCollection, List.of());

        assertThrows(FlowVersionNotFoundException.class,
                () -> store.getFlowForVersion(flow("9.0.0")));
    }

    @Test
    public void return_the_content_of_a_stored_version() throws Exception {
        flowExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("content", VALID_JSON)));

        assertThat(store.getFlowForVersion(flow("1.0.0")), is(VALID_JSON));
    }

    // --- createFlowForVersion ---

    @Test
    public void reject_invalid_json_before_checking_the_flow_exists() {
        flowDoesNotExist();
        Flow invalid = new Flow.FlowBuilder()
                .setNamespace(NAMESPACE).setId(FLOW_ID).setVersion("1.0.1")
                .setFlow("{invalid json}").build();

        // Deliberate divergence from Mongo, which reports the missing flow first.
        assertThrows(JsonParseException.class, () -> store.createFlowForVersion(invalid));
    }

    @Test
    public void throw_a_flow_exception_when_creating_a_version_for_a_missing_flow() {
        flowDoesNotExist();

        assertThrows(FlowNotFoundException.class,
                () -> store.createFlowForVersion(flow("1.0.1")));
    }

    @Test
    public void throw_a_version_exists_exception_when_the_version_is_already_stored() {
        flowExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.1")));

        assertThrows(FlowVersionExistsException.class,
                () -> store.createFlowForVersion(flow("1.0.1")));
    }

    @Test
    public void not_rename_the_flow_when_the_version_already_exists() {
        flowExists();
        stubFind(versionCollection, List.of(Document.createDocument().put("version", "1.0.1")));

        assertThrows(FlowVersionExistsException.class,
                () -> store.createFlowForVersion(flow("1.0.1")));

        verify(headerCollection, never()).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void write_the_version_and_then_the_header_details() throws Exception {
        flowExists();
        stubFind(versionCollection, List.of());

        store.createFlowForVersion(flow("1.0.1"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.1"));
        // Two header writes: the versionCount increment, then the name/description update.
        verify(headerCollection, times(2)).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void leave_the_stored_name_alone_when_a_version_write_carries_none() throws Exception {
        flowExists();
        stubFind(versionCollection, List.of());

        store.createFlowForVersion(flow("1.0.1", null, null));

        // Flow guards these fields where Architecture overwrites them, so only the
        // versionCount write happens here.
        verify(headerCollection, times(1)).update(any(Filter.class), any(Document.class));
    }

    // --- updateFlowForVersion ---

    @Test
    public void throw_a_flow_exception_when_updating_a_version_for_a_missing_flow() {
        flowDoesNotExist();

        assertThrows(FlowNotFoundException.class,
                () -> store.updateFlowForVersion(flow("1.0.1")));
    }

    @Test
    public void replace_the_content_of_an_existing_version_on_update() throws Exception {
        flowExists();
        stubFind(versionCollection, List.of(Document.createDocument()
                .put("version", "1.0.1").put("content", "{\"old\":true}")));

        store.updateFlowForVersion(flow("1.0.1"));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).update(any(Filter.class), captor.capture());
        assertThat(captor.getValue().get("content", String.class), is(VALID_JSON));
    }

    @Test
    public void create_the_version_when_updating_one_that_does_not_exist() throws Exception {
        flowExists();
        stubFind(versionCollection, List.of());

        // Preserves the known create-on-PUT behaviour (bugs.md #1) rather than changing it.
        store.updateFlowForVersion(flow("2.0.0"));

        verify(versionCollection).insert(any(Document.class));
    }
}
