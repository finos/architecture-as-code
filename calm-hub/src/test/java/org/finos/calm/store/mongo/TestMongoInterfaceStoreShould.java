package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;
import java.util.function.Consumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
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
 * {@code TestMongoVersionDocumentStoreShould}. Interface differs from Pattern and Flow in two
 * ways this class pins: version writes set name/description unconditionally, and there is no
 * update path at all.
 */
@QuarkusTest
public class TestMongoInterfaceStoreShould {

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
    private MongoInterfaceStore store;

    private static final String NAMESPACE = "finos";
    private static final int INTERFACE_ID = 42;
    private static final String VALID_JSON = "{\"test\": \"test\"}";

    @BeforeEach
    void setup() throws NamespaceNotFoundException {
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        headerCollection = Mockito.mock(DocumentMongoCollection.class);
        versionCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("interfaces")).thenReturn(headerCollection);
        when(mongoDatabase.getCollection("interfaceVersions")).thenReturn(versionCollection);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new MongoInterfaceStore(mongoDatabase, counterStore, namespaceStore);
    }

    private void stubFind(MongoCollection<Document> collection, List<Document> documents) {
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
    }

    private void interfaceExists() {
        stubFind(headerCollection, List.of(new Document("interfaceId", INTERFACE_ID)));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
    }

    private void interfaceDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static MongoWriteException writeError(int code, String message) {
        return new MongoWriteException(new WriteError(code, message, new BsonDocument()), new ServerAddress(), List.of());
    }

    private static CreateInterfaceRequest createRequest() {
        return new CreateInterfaceRequest("interface-name", "interface-description", VALID_JSON);
    }

    // --- getInterfacesForNamespace ---

    @Test
    void throw_a_namespace_exception_when_listing_interfaces_for_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getInterfacesForNamespace(NAMESPACE));
    }

    @Test
    void return_an_empty_list_when_a_namespace_has_no_interfaces() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getInterfacesForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    void return_a_summary_per_header_document_without_a_version_count() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(
                new Document("interfaceId", 1).append("name", "First").append("description", "d1")
                        .append("versionCount", 2),
                new Document("interfaceId", 2).append("name", "Second").append("description", "d2")
                        .append("versionCount", 0)));

        assertThat(store.getInterfacesForNamespace(NAMESPACE), contains(
                new NamespaceInterfaceSummary("First", "d1", 1),
                new NamespaceInterfaceSummary("Second", "d2", 2)));
    }

    // --- createInterfaceForNamespace ---

    @Test
    void throw_a_namespace_exception_when_creating_a_interface_in_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createInterfaceForNamespace(createRequest(), NAMESPACE));
    }

    @Test
    void reject_invalid_json_before_drawing_an_id_or_writing_anything() {
        CreateInterfaceRequest invalid = new CreateInterfaceRequest("n", "d", "{invalid json}");

        assertThrows(JsonParseException.class, () -> store.createInterfaceForNamespace(invalid, NAMESPACE));

        verify(counterStore, never()).getNextInterfaceSequenceValue();
        verify(headerCollection, never()).insertOne(any(Document.class));
    }

    @Test
    void create_a_header_and_an_initial_version() throws NamespaceNotFoundException {
        when(counterStore.getNextInterfaceSequenceValue()).thenReturn(99);
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        CalmInterface created = store.createInterfaceForNamespace(createRequest(), NAMESPACE);

        assertThat(created.getId(), is(99));
        assertThat(created.getVersion(), is("1.0.0"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.0"));
    }

    @Test
    void remove_the_header_again_when_the_first_version_write_fails() {
        when(counterStore.getNextInterfaceSequenceValue()).thenReturn(99);
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(StorageWriteException.class,
                () -> store.createInterfaceForNamespace(createRequest(), NAMESPACE));

        verify(headerCollection).deleteOne(any(Bson.class));
    }

    // --- getInterfaceVersions ---

    @Test
    void throw_a_interface_exception_when_listing_versions_for_a_missing_interface() {
        interfaceDoesNotExist();

        assertThrows(InterfaceNotFoundException.class, () -> store.getInterfaceVersions(NAMESPACE, INTERFACE_ID));
    }

    @Test
    void list_versions_in_semantic_order() throws NamespaceNotFoundException, InterfaceNotFoundException {
        stubFind(headerCollection, List.of(new Document("interfaceId", INTERFACE_ID)));
        stubFind(versionCollection, List.of(
                new Document("version", "1.10.0"),
                new Document("version", "1.9.0"),
                new Document("version", "1.0.0")));

        assertThat(store.getInterfaceVersions(NAMESPACE, INTERFACE_ID), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    void check_existence_against_the_interface_id_not_just_the_namespace() throws Exception {
        // The old store carried a FIXME: it looked up only the namespace and ignored the id,
        // which happened to work while a namespace held a single interface.
        interfaceDoesNotExist();

        assertThrows(InterfaceNotFoundException.class,
                () -> store.getInterfaceVersions(NAMESPACE, 999));
    }

    // --- getInterfaceForVersion ---

    @Test
    void throw_a_version_exception_when_the_version_is_not_stored() {
        stubFind(headerCollection, List.of(new Document("interfaceId", INTERFACE_ID)));
        stubFind(versionCollection, List.of());

        assertThrows(InterfaceVersionNotFoundException.class,
                () -> store.getInterfaceForVersion(NAMESPACE, INTERFACE_ID, "9.0.0"));
    }

    @Test
    void return_the_content_of_a_stored_version() throws Exception {
        stubFind(headerCollection, List.of(new Document("interfaceId", INTERFACE_ID)));
        stubFind(versionCollection, List.of(new Document("content", new Document("test", "test"))));

        assertThat(store.getInterfaceForVersion(NAMESPACE, INTERFACE_ID, "1.0.0"), containsString("\"test\""));
    }

    // --- createInterfaceForVersion ---

    @Test
    void throw_a_interface_exception_when_creating_a_version_for_a_missing_interface() {
        interfaceDoesNotExist();

        assertThrows(InterfaceNotFoundException.class,
                () -> store.createInterfaceForVersion(createRequest(), NAMESPACE, INTERFACE_ID, "1.0.1"));
    }

    @Test
    void throw_a_version_exists_exception_when_the_version_is_already_stored() {
        interfaceExists();
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(InterfaceVersionExistsException.class,
                () -> store.createInterfaceForVersion(createRequest(), NAMESPACE, INTERFACE_ID, "1.0.1"));
    }

    @Test
    void write_the_version_and_then_the_header_details() throws Exception {
        interfaceExists();

        store.createInterfaceForVersion(createRequest(), NAMESPACE, INTERFACE_ID, "1.0.1");

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.1"));
        // Two header writes: the versionCount increment and the name/description update.
        verify(headerCollection, Mockito.times(2)).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void overwrite_the_header_details_even_when_blank() throws Exception {
        interfaceExists();

        store.createInterfaceForVersion(new CreateInterfaceRequest(null, null, VALID_JSON),
                NAMESPACE, INTERFACE_ID, "1.0.1");

        // Interface's old shape $set both fields unconditionally, unlike Pattern and Flow
        // which guarded them. Preserved rather than harmonised — see the store's javadoc.
        verify(headerCollection, Mockito.times(2)).updateOne(any(Bson.class), any(Bson.class));
    }

    // --- deleteInterface ---

    @Test
    void throw_a_namespace_exception_when_deleting_an_interface_in_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.deleteInterface(NAMESPACE, INTERFACE_ID));
    }

    @Test
    void delete_the_header_and_all_versions_when_the_interface_exists() throws Exception {
        when(headerCollection.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(1));

        store.deleteInterface(NAMESPACE, INTERFACE_ID);

        verify(versionCollection).deleteMany(any(Bson.class));
        verify(headerCollection).deleteOne(any(Bson.class));
    }

    @Test
    void throw_an_interface_exception_when_deleting_a_missing_interface() {
        when(headerCollection.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(0));

        assertThrows(InterfaceNotFoundException.class, () -> store.deleteInterface(NAMESPACE, INTERFACE_ID));
    }
}
