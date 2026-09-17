package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;
import java.util.function.Consumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doCallRealMethod;

/**
 * Store-level tests for the header/version shape. Document mechanics are covered by
 * {@code TestMongoVersionDocumentStoreShould}; what this class pins is the glue — which
 * domain exception each missing thing produces, and Flow's blank-guarding of
 * name/description, which is where it deliberately differs from Architecture.
 */
@QuarkusTest
public class TestMongoFlowStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoCollection<Document> headerCollection;
    private MongoCollection<Document> versionCollection;
    private MongoFlowStore store;

    private static final String NAMESPACE = "finos";
    private static final int FLOW_ID = 42;
    private static final String VALID_JSON = "{\"test\": \"test\"}";

    @BeforeEach
    void setup() throws NamespaceNotFoundException {
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        headerCollection = Mockito.mock(DocumentMongoCollection.class);
        versionCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("flows")).thenReturn(headerCollection);
        when(mongoDatabase.getCollection("flowVersions")).thenReturn(versionCollection);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new MongoFlowStore(mongoDatabase, counterStore, namespaceStore);
    }

    private FindIterable<Document> stubFind(MongoCollection<Document> collection, List<Document> documents) {
        FindIterable<Document> iterable = Mockito.mock(DocumentFindIterable.class);
        when(collection.find(any(Bson.class))).thenReturn(iterable);
        when(iterable.projection(any())).thenReturn(iterable);
        when(iterable.sort(any())).thenReturn(iterable);
        when(iterable.skip(anyInt())).thenReturn(iterable);
        when(iterable.limit(anyInt())).thenReturn(iterable);
        when(iterable.first()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            documents.forEach(consumer);
            return null;
        }).when(iterable).forEach(any());
        return iterable;
    }

    private void flowExists() {
        stubFind(headerCollection, List.of(new Document("flowId", FLOW_ID)));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
    }

    private void flowDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static MongoWriteException writeError(int code, String message) {
        return new MongoWriteException(new WriteError(code, message, new BsonDocument()), new ServerAddress(), List.of());
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
        return flow(version, "flow-name", "flow-description");
    }

    private static CreateFlowRequest createRequest() {
        return new CreateFlowRequest("flow-name", "flow-description", VALID_JSON);
    }

    // --- getFlowsForNamespace ---

    @Test
    void throw_a_namespace_exception_when_listing_flows_for_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getFlowsForNamespace(NAMESPACE));
    }

    @Test
    void return_an_empty_list_when_a_namespace_has_no_flows() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getFlowsForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    void return_a_summary_per_header_document() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(
                new Document("flowId", 1).append("name", "First").append("description", "d1")
                        .append("versionCount", 2),
                new Document("flowId", 2).append("name", "Second").append("description", "d2")
                        .append("versionCount", 0)));

        assertThat(store.getFlowsForNamespace(NAMESPACE), contains(
                new NamespaceResourceSummary("First", "d1", 1, 2),
                new NamespaceResourceSummary("Second", "d2", 2, 0)));
    }

    @Test
    void fall_back_to_a_generated_name_for_headers_missing_one() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(new Document("flowId", 7)));

        assertThat(store.getFlowsForNamespace(NAMESPACE), contains(
                new NamespaceResourceSummary("Flow 7", "", 7, 0)));
    }


    // --- createFlowForNamespace ---

    @Test
    void throw_a_namespace_exception_when_creating_a_flow_in_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createFlowForNamespace(createRequest(), NAMESPACE));
    }

    @Test
    void reject_invalid_json_before_drawing_an_id_or_writing_anything() {
        CreateFlowRequest invalid = new CreateFlowRequest("n", "d", "{invalid json}");

        assertThrows(JsonParseException.class, () -> store.createFlowForNamespace(invalid, NAMESPACE));

        verify(counterStore, never()).getNextFlowSequenceValue();
        verify(headerCollection, never()).insertOne(any(Document.class));
    }

    @Test
    void create_a_header_and_an_initial_version() throws NamespaceNotFoundException {
        when(counterStore.getNextFlowSequenceValue()).thenReturn(99);
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        Flow created = store.createFlowForNamespace(createRequest(), NAMESPACE);

        assertThat(created.getId(), is(99));
        // Dot-separated on both backends now; Nitrite used to return "1-0-0" here.
        assertThat(created.getDotVersion(), is("1.0.0"));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).insertOne(headerCaptor.capture());
        assertThat(headerCaptor.getValue().getInteger("flowId"), is(99));
        assertThat(headerCaptor.getValue().getInteger("versionCount"), is(0));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.0"));
    }

    @Test
    void remove_the_header_again_when_the_first_version_write_fails() {
        when(counterStore.getNextFlowSequenceValue()).thenReturn(99);
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(StorageWriteException.class,
                () -> store.createFlowForNamespace(createRequest(), NAMESPACE));

        verify(headerCollection).deleteOne(any(Bson.class));
    }

    // --- getFlowVersions ---

    @Test
    void throw_a_namespace_exception_when_listing_versions_for_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getFlowVersions(flow(null)));
    }

    @Test
    void throw_a_flow_exception_when_listing_versions_for_a_missing_flow() {
        flowDoesNotExist();

        assertThrows(FlowNotFoundException.class, () -> store.getFlowVersions(flow(null)));
    }

    @Test
    void list_versions_in_semantic_order() throws NamespaceNotFoundException, FlowNotFoundException {
        stubFind(headerCollection, List.of(new Document("flowId", FLOW_ID)));
        stubFind(versionCollection, List.of(
                new Document("version", "1.10.0"),
                new Document("version", "1.9.0"),
                new Document("version", "1.0.0")));

        assertThat(store.getFlowVersions(flow(null)), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    void return_no_versions_rather_than_not_found_for_a_flow_with_none() throws NamespaceNotFoundException, FlowNotFoundException {
        stubFind(headerCollection, List.of(new Document("flowId", FLOW_ID)));
        stubFind(versionCollection, List.of());

        // ADR 0003: the header proves the flow exists, so an empty version list is an
        // answer rather than evidence of a missing flow.
        assertThat(store.getFlowVersions(flow(null)), is(empty()));
    }

    // --- getFlowForVersion ---

    @Test
    void throw_a_flow_exception_when_getting_a_version_of_a_missing_flow() {
        flowDoesNotExist();

        assertThrows(FlowNotFoundException.class, () -> store.getFlowForVersion(flow("1.0.0")));
    }

    @Test
    void throw_a_version_exception_when_the_version_is_not_stored() {
        stubFind(headerCollection, List.of(new Document("flowId", FLOW_ID)));
        stubFind(versionCollection, List.of());

        assertThrows(FlowVersionNotFoundException.class,
                () -> store.getFlowForVersion(flow("9.0.0")));
    }

    @Test
    void return_the_content_of_a_stored_version() throws Exception {
        stubFind(headerCollection, List.of(new Document("flowId", FLOW_ID)));
        stubFind(versionCollection, List.of(new Document("content", new Document("test", "test"))));

        assertThat(store.getFlowForVersion(flow("1.0.0")), containsString("\"test\""));
    }

    // --- createFlowForVersion ---

    @Test
    void throw_a_flow_exception_when_creating_a_version_for_a_missing_flow() {
        flowDoesNotExist();

        assertThrows(FlowNotFoundException.class,
                () -> store.createFlowForVersion(flow("1.0.1")));
    }

    @Test
    void throw_a_version_exists_exception_when_the_version_is_already_stored() {
        flowExists();
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(FlowVersionExistsException.class,
                () -> store.createFlowForVersion(flow("1.0.1")));
    }

    @Test
    void not_rename_the_flow_when_the_version_already_exists() {
        flowExists();
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(FlowVersionExistsException.class,
                () -> store.createFlowForVersion(flow("1.0.1")));

        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void write_the_version_and_then_the_header_details() throws Exception {
        flowExists();

        store.createFlowForVersion(flow("1.0.1"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.1"));
        // Two header writes: the versionCount increment and the name/description update.
        verify(headerCollection, Mockito.times(2)).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void leave_the_stored_name_alone_when_a_version_write_carries_none() throws Exception {
        flowExists();

        store.createFlowForVersion(flow("1.0.1", null, null));

        // Where Architecture overwrites unconditionally — wiping the display name, bugs.md
        // #2 — Flow's old shape guarded these fields, so only the count write happens.
        verify(headerCollection, Mockito.times(1)).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void update_only_the_details_that_are_present() throws Exception {
        flowExists();

        store.createFlowForVersion(flow("1.0.1", "Renamed", "  "));

        ArgumentCaptor<Bson> updateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection, Mockito.times(2)).updateOne(any(Bson.class), updateCaptor.capture());
        String detailsUpdate = updateCaptor.getAllValues().get(1).toBsonDocument().toJson();
        assertThat(detailsUpdate, containsString("Renamed"));
        assertThat(detailsUpdate, not(containsString("description")));
    }

    // --- updateFlowForVersion ---

    @Test
    void throw_a_flow_exception_when_updating_a_version_for_a_missing_flow() {
        flowDoesNotExist();

        assertThrows(FlowNotFoundException.class,
                () -> store.updateFlowForVersion(flow("1.0.1")));
    }

    @Test
    void force_write_a_version_on_update() throws Exception {
        flowExists();
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        store.updateFlowForVersion(flow("1.0.1"));

        verify(versionCollection).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
        // Replacing an existing version doesn't move the count, so the only header write
        // here is the name/description update.
        verify(headerCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void report_capacity_exceeded_when_a_version_write_hits_the_document_size_limit() {
        flowExists();
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(writeError(10334, "object to insert too large"));

        StorageWriteException exception = assertThrows(StorageWriteException.class,
                () -> store.updateFlowForVersion(flow("1.0.1")));
        assertThat(exception.isCapacityExceeded(), is(true));
    }

    @Test
    void report_a_plain_write_failure_for_other_version_write_errors() {
        flowExists();
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(writeError(10107, "not master"));

        StorageWriteException exception = assertThrows(StorageWriteException.class,
                () -> store.updateFlowForVersion(flow("1.0.1")));
        assertThat(exception.isCapacityExceeded(), is(false));
    }

    // --- deleteFlow ---

    @Test
    void throw_a_namespace_exception_when_deleting_a_flow_in_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.deleteFlow(NAMESPACE, FLOW_ID));
    }

    @Test
    void delete_the_header_and_all_versions_when_the_flow_exists() throws Exception {
        when(headerCollection.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(1));

        store.deleteFlow(NAMESPACE, FLOW_ID);

        verify(versionCollection).deleteMany(any(Bson.class));
        verify(headerCollection).deleteOne(any(Bson.class));
    }

    @Test
    void throw_a_flow_exception_when_deleting_a_missing_flow() {
        when(headerCollection.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(0));

        assertThrows(FlowNotFoundException.class, () -> store.deleteFlow(NAMESPACE, FLOW_ID));
    }
}
