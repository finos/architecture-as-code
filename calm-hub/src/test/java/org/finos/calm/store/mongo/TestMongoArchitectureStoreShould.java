package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.UpdateResult;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
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

/**
 * Store-level tests for the header/version shape. The document mechanics themselves are
 * covered by {@code TestMongoVersionDocumentStoreShould} — what matters here is the glue
 * this class owns: which domain exception each missing thing produces, and the ordering
 * between a version write and the header details that accompany it.
 */
@QuarkusTest
public class TestMongoArchitectureStoreShould {

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
    private MongoArchitectureStore store;

    private static final String NAMESPACE = "finos";
    private static final int ARCHITECTURE_ID = 42;
    private static final String VALID_JSON = "{\"test\": \"test\"}";

    @BeforeEach
    void setup() {
        headerCollection = Mockito.mock(DocumentMongoCollection.class);
        versionCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("architectures")).thenReturn(headerCollection);
        when(mongoDatabase.getCollection("architectureVersions")).thenReturn(versionCollection);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new MongoArchitectureStore(mongoDatabase, counterStore, namespaceStore);
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

    /** The architecture exists: its header is found, and the count write is acknowledged. */
    private void architectureExists() {
        stubFind(headerCollection, List.of(new Document("architectureId", ARCHITECTURE_ID)));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
    }

    private void architectureDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static MongoWriteException writeError(int code, String message) {
        return new MongoWriteException(new WriteError(code, message, new BsonDocument()), new ServerAddress(), List.of());
    }

    private static Architecture architecture(String version) {
        return new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(version)
                .setName("architecture-name")
                .setDescription("architecture-description")
                .setArchitecture(VALID_JSON)
                .build();
    }

    // --- getArchitecturesForNamespace ---

    @Test
    void throw_a_namespace_exception_when_listing_architectures_for_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getArchitecturesForNamespace(NAMESPACE));
    }

    @Test
    void return_an_empty_list_when_a_namespace_has_no_architectures() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getArchitecturesForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    void return_a_summary_per_header_document() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(
                new Document("architectureId", 1).append("name", "First").append("description", "d1")
                        .append("versionCount", 2),
                new Document("architectureId", 2).append("name", "Second").append("description", "d2")
                        .append("versionCount", 0)));

        // versionCount now comes off the header rather than being counted from a loaded
        // versions map — including 0, which the old shape could not represent at all.
        assertThat(store.getArchitecturesForNamespace(NAMESPACE), contains(
                new NamespaceResourceSummary("First", "d1", 1, 2),
                new NamespaceResourceSummary("Second", "d2", 2, 0)));
    }

    @Test
    void fall_back_to_a_generated_name_for_headers_missing_one() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of(new Document("architectureId", 7)));

        assertThat(store.getArchitecturesForNamespace(NAMESPACE), contains(
                new NamespaceResourceSummary("Architecture 7", "", 7, 0)));
    }

    // --- architectureExists ---

    @Test
    void throw_a_namespace_exception_when_checking_existence_for_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.architectureExists(NAMESPACE, ARCHITECTURE_ID));
    }

    @Test
    void return_true_when_the_architecture_header_exists() throws NamespaceNotFoundException {
        architectureExists();

        assertThat(store.architectureExists(NAMESPACE, ARCHITECTURE_ID), is(true));
    }

    @Test
    void return_false_when_the_architecture_header_is_absent() throws NamespaceNotFoundException {
        architectureDoesNotExist();

        assertThat(store.architectureExists(NAMESPACE, ARCHITECTURE_ID), is(false));
    }

    // --- createArchitectureForNamespace ---

    @Test
    void throw_a_namespace_exception_when_creating_an_architecture_in_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createArchitectureForNamespace(architecture(null)));
    }

    @Test
    void reject_invalid_json_before_drawing_an_id_or_writing_anything() {
        Architecture invalid = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE).setArchitecture("{invalid json}").build();

        assertThrows(JsonParseException.class, () -> store.createArchitectureForNamespace(invalid));

        // Parsing first means a malformed payload can't burn a sequence value or leave a
        // header behind with no version to go with it.
        verify(counterStore, never()).getNextArchitectureSequenceValue();
        verify(headerCollection, never()).insertOne(any(Document.class));
    }

    @Test
    void create_a_header_and_an_initial_version() throws NamespaceNotFoundException {
        when(counterStore.getNextArchitectureSequenceValue()).thenReturn(99);
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        Architecture created = store.createArchitectureForNamespace(architecture(null));

        assertThat(created.getId(), is(99));
        assertThat(created.getDotVersion(), is("1.0.0"));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).insertOne(headerCaptor.capture());
        assertThat(headerCaptor.getValue().getInteger("architectureId"), is(99));
        assertThat(headerCaptor.getValue().getInteger("versionCount"), is(0));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.0"));
    }

    @Test
    void remove_the_header_again_when_the_first_version_write_fails() {
        when(counterStore.getNextArchitectureSequenceValue()).thenReturn(99);
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(versionCollection).insertOne(any(Document.class));

        // The old shape pushed the architecture and its first version in one document
        // write, so a failure left nothing behind. Without compensating, a >16MB payload
        // strands a header that no endpoint can delete, showing up in listings and search
        // with versionCount 0 forever.
        assertThrows(StorageWriteException.class,
                () -> store.createArchitectureForNamespace(architecture(null)));

        verify(headerCollection).deleteOne(any(Bson.class));
    }

    @Test
    void fail_rather_than_report_success_when_the_initial_version_already_exists() {
        when(counterStore.getNextArchitectureSequenceValue()).thenReturn(99);
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        // A version document already present for an id the counter just issued is a storage
        // inconsistency, not a normal "already exists". Returning the caller's payload with
        // a 201 would report success for content that was never stored.
        assertThrows(StorageWriteException.class,
                () -> store.createArchitectureForNamespace(architecture(null)));

        verify(headerCollection).deleteOne(any(Bson.class));
    }

    // --- getArchitectureVersions ---

    @Test
    void throw_a_namespace_exception_when_listing_versions_for_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getArchitectureVersions(architecture(null)));
    }

    @Test
    void throw_an_architecture_exception_when_listing_versions_for_a_missing_architecture() {
        architectureDoesNotExist();

        assertThrows(ArchitectureNotFoundException.class, () -> store.getArchitectureVersions(architecture(null)));
    }

    @Test
    void list_versions_in_semantic_order() throws NamespaceNotFoundException, ArchitectureNotFoundException {
        stubFind(headerCollection, List.of(new Document("architectureId", ARCHITECTURE_ID)));
        stubFind(versionCollection, List.of(
                new Document("version", "1.10.0"),
                new Document("version", "1.9.0"),
                new Document("version", "1.0.0")));

        assertThat(store.getArchitectureVersions(architecture(null)), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    void return_no_versions_rather_than_not_found_for_an_architecture_with_none() throws NamespaceNotFoundException, ArchitectureNotFoundException {
        stubFind(headerCollection, List.of(new Document("architectureId", ARCHITECTURE_ID)));
        stubFind(versionCollection, List.of());

        // New under this shape (ADR 0003): the header proves the architecture exists, so an
        // empty version list is an answer rather than evidence of a missing architecture.
        // The old shape conflated the two because it had nowhere else to look.
        assertThat(store.getArchitectureVersions(architecture(null)), is(empty()));
    }

    // --- getArchitectureForVersion ---

    @Test
    void throw_a_namespace_exception_when_getting_a_version_from_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getArchitectureForVersion(architecture("1.0.0")));
    }

    @Test
    void throw_an_architecture_exception_when_getting_a_version_of_a_missing_architecture() {
        architectureDoesNotExist();

        assertThrows(ArchitectureNotFoundException.class, () -> store.getArchitectureForVersion(architecture("1.0.0")));
    }

    @Test
    void throw_a_version_exception_when_the_version_is_not_stored() {
        stubFind(headerCollection, List.of(new Document("architectureId", ARCHITECTURE_ID)));
        stubFind(versionCollection, List.of());

        assertThrows(ArchitectureVersionNotFoundException.class,
                () -> store.getArchitectureForVersion(architecture("9.0.0")));
    }

    @Test
    void return_the_content_of_a_stored_version() throws Exception {
        stubFind(headerCollection, List.of(new Document("architectureId", ARCHITECTURE_ID)));
        stubFind(versionCollection, List.of(new Document("content", new Document("test", "test"))));

        assertThat(store.getArchitectureForVersion(architecture("1.0.0")), containsString("\"test\""));
    }

    // --- createArchitectureForVersion ---

    @Test
    void throw_a_namespace_exception_when_creating_a_version_in_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    void throw_an_architecture_exception_when_creating_a_version_for_a_missing_architecture() {
        architectureDoesNotExist();

        assertThrows(ArchitectureNotFoundException.class,
                () -> store.createArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    void throw_a_version_exists_exception_when_the_version_is_already_stored() {
        architectureExists();
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(ArchitectureVersionExistsException.class,
                () -> store.createArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    void not_rename_the_architecture_when_the_version_already_exists() {
        architectureExists();
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(ArchitectureVersionExistsException.class,
                () -> store.createArchitectureForVersion(architecture("1.0.1")));

        // The old shape set name/description in the same conditional update that wrote the
        // content, so a rejected create changed nothing. Splitting the two writes makes it
        // possible to rename on a request that then 409s — this pins that we don't.
        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void write_the_version_and_then_the_header_details() throws Exception {
        architectureExists();

        store.createArchitectureForVersion(architecture("1.0.1"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.1"));
        // Two header writes: the versionCount increment and the name/description update.
        verify(headerCollection, Mockito.times(2)).updateOne(any(Bson.class), any(Bson.class));
    }

    // --- updateArchitectureForVersion ---

    @Test
    void throw_a_namespace_exception_when_updating_a_version_in_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.updateArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    void throw_an_architecture_exception_when_updating_a_version_for_a_missing_architecture() {
        architectureDoesNotExist();

        assertThrows(ArchitectureNotFoundException.class,
                () -> store.updateArchitectureForVersion(architecture("1.0.1")));
    }

    @Test
    void force_write_a_version_on_update() throws Exception {
        architectureExists();
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        store.updateArchitectureForVersion(architecture("1.0.1"));

        verify(versionCollection).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
        // Replacing an existing version doesn't move the count, so the only header write
        // here is the name/description update.
        verify(headerCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void report_capacity_exceeded_when_a_version_write_hits_the_document_size_limit() {
        architectureExists();
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(writeError(10334, "object to insert too large"));

        StorageWriteException exception = assertThrows(StorageWriteException.class,
                () -> store.updateArchitectureForVersion(architecture("1.0.1")));
        assertThat(exception.isCapacityExceeded(), is(true));
    }

    @Test
    void report_a_plain_write_failure_for_other_version_write_errors() {
        architectureExists();
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(writeError(10107, "not master"));

        StorageWriteException exception = assertThrows(StorageWriteException.class,
                () -> store.updateArchitectureForVersion(architecture("1.0.1")));
        assertThat(exception.isCapacityExceeded(), is(false));
    }

    @Test
    void page_the_summary_window_at_the_database() throws NamespaceNotFoundException {
        FindIterable<Document> iterable = stubFind(headerCollection, List.of());

        store.getArchitecturesForNamespace(NAMESPACE, new PageRequest(2, 1)); // limit 2, offset 1

        // No $slice projection any more — headers are one document per architecture, so
        // paging is ordinary skip/limit rather than slicing into an array field.
        verify(iterable).skip(1);
        verify(iterable).limit(2);
    }
}
