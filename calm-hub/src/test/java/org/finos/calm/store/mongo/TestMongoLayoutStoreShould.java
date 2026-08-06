package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.ReplaceOptions;
import org.bson.BsonDocument;
import org.bson.BsonMaximumSizeExceededException;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestMongoLayoutStoreShould {

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    @Mock
    private MongoDatabase database;

    @Mock
    private MongoCollection<Document> layoutCollection;

    @Mock
    private MongoNamespaceStore namespaceStore;

    private MongoLayoutStore layoutStore;

    private static final String LAYOUT_JSON = "{\"for\": \"/api/calm/namespaces/finos/architectures/5\", \"pins\": []}";

    @BeforeEach
    void setUp() {
        when(database.getCollection("layouts")).thenReturn(layoutCollection);
        layoutStore = new MongoLayoutStore(database, namespaceStore);
    }

    // ---- getLayout ----

    @Test
    void return_layout_when_document_exists() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document layoutDoc = Document.parse(LAYOUT_JSON);
        Document document = new Document("namespace", namespace).append("architectureId", 5).append("layout", layoutDoc);

        FindIterable<Document> findIterable = mock(DocumentFindIterable.class);
        when(layoutCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(document);

        Optional<String> result = layoutStore.getLayout(namespace, 5);

        assertTrue(result.isPresent());
        assertEquals(layoutDoc, Document.parse(result.get()));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_empty_when_no_document_matches_architecture() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        FindIterable<Document> findIterable = mock(DocumentFindIterable.class);
        when(layoutCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        Optional<String> result = layoutStore.getLayout(namespace, 5);

        assertFalse(result.isPresent());
    }

    @Test
    void return_empty_when_the_document_holds_no_layout() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document document = new Document("namespace", namespace).append("architectureId", 5);

        FindIterable<Document> findIterable = mock(DocumentFindIterable.class);
        when(layoutCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(document);

        assertFalse(layoutStore.getLayout(namespace, 5).isPresent());
    }

    @Test
    void throw_namespace_not_found_when_getting_layout_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.getLayout(namespace, 5));
        verify(layoutCollection, never()).find(any(Bson.class));
    }

    // ---- upsertLayout ----

    @Test
    void save_via_a_single_replace_one_upsert() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        verify(layoutCollection, times(1)).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    @Test
    void retry_the_replace_once_when_two_concurrent_upserts_collide() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        // Both saves missed the filter and both attempted an insert; the unique index on
        // (namespace, architectureId) let only the other one through.
        when(layoutCollection.replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()))
                .thenReturn(null);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        verify(layoutCollection, times(2)).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    @Test
    void surface_a_write_failure_when_the_retry_also_hits_a_duplicate_key() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        // A second duplicate key on the retry means the index no longer agrees with the
        // filter — a fault, not a race to keep retrying.
        when(layoutCollection.replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()));

        assertThrows(StorageWriteException.class, () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));

        verify(layoutCollection, times(2)).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    @Test
    void surface_capacity_exceeded_when_the_server_rejects_an_oversized_document() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        when(layoutCollection.replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(10334, "object to save is too large", new BsonDocument()), new ServerAddress(), List.of()));

        StorageWriteException exception = assertThrows(StorageWriteException.class,
                () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));

        assertTrue(exception.isCapacityExceeded());
        verify(layoutCollection, times(1)).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    @Test
    void surface_capacity_exceeded_when_the_layout_itself_exceeds_the_bson_limit() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        // Unlike the old shape, a single write can already exceed the 16MB ceiling before it
        // is even sent — the driver rejects it client-side while serializing the command, so
        // no MongoWriteException is ever raised.
        when(layoutCollection.replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class)))
                .thenThrow(new BsonMaximumSizeExceededException("document exceeds maximum allowed size"));

        StorageWriteException exception = assertThrows(StorageWriteException.class,
                () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));

        assertTrue(exception.isCapacityExceeded());
        verify(layoutCollection, times(1)).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    @Test
    void propagate_non_duplicate_key_write_errors() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        when(layoutCollection.replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(12, "some other error", new BsonDocument()), new ServerAddress(), List.of()));

        StorageWriteException exception = assertThrows(StorageWriteException.class,
                () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));

        assertFalse(exception.isCapacityExceeded());
        verify(layoutCollection, times(1)).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    @Test
    void throw_namespace_not_found_when_saving_layout_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));
        verify(layoutCollection, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    // ---- getArchitectureIdsWithLayoutForNamespace ----

    @Test
    void return_architecture_ids_with_saved_layouts() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        stubProjectedDocuments(List.of(
                new Document("architectureId", 5),
                new Document("architectureId", 6)
        ));

        List<Integer> ids = layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace);

        assertEquals(List.of(5, 6), ids);
    }

    @Test
    void skip_a_document_with_no_architecture_id() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        stubProjectedDocuments(List.of(new Document()));

        assertTrue(layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace).isEmpty());
    }

    @Test
    void return_empty_list_when_no_layouts_exist_for_the_namespace() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        stubProjectedDocuments(List.of());

        assertTrue(layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace).isEmpty());
    }

    @Test
    void throw_namespace_not_found_when_listing_layout_ids_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace));
        verify(layoutCollection, never()).find(any(Bson.class));
    }

    /**
     * Models {@code getArchitectureIdsWithLayoutForNamespace}'s {@code find(...).projection(...).forEach(...)}
     * chain — the projected iterable drives the given documents through the consumer passed to
     * {@code forEach}.
     */
    @SuppressWarnings("unchecked")
    private void stubProjectedDocuments(List<Document> documents) {
        FindIterable<Document> findIterable = mock(DocumentFindIterable.class);
        when(layoutCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.projection(any())).thenReturn(findIterable);
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            documents.forEach(consumer);
            return null;
        }).when(findIterable).forEach(any(Consumer.class));
    }
}
