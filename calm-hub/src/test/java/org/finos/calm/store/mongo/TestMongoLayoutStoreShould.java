package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.UpdateResult;
import org.bson.BsonDocument;
import org.bson.BsonObjectId;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.types.ObjectId;
import org.finos.calm.domain.exception.LayoutNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestMongoLayoutStoreShould {

    @Mock
    private MongoDatabase database;

    @Mock
    private MongoCollection<Document> layoutCollection;

    @Mock
    private MongoNamespaceStore namespaceStore;

    @Mock
    private FindIterable<Document> findIterable;

    private MongoLayoutStore layoutStore;

    private static final String LAYOUT_JSON = "{\"for\": \"/api/calm/namespaces/finos/architectures/5\", \"pins\": []}";

    @BeforeEach
    void setUp() {
        when(database.getCollection("layouts")).thenReturn(layoutCollection);
        layoutStore = new MongoLayoutStore(database, namespaceStore);
    }

    // ---- getLayout ----

    @Test
    void return_layout_when_entry_exists() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document layoutDoc = Document.parse(LAYOUT_JSON);
        Document namespaceDocument = new Document("namespace", namespace)
                .append("layouts", List.of(new Document("architectureId", 5).append("layout", layoutDoc)));

        when(layoutCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

        Optional<String> result = layoutStore.getLayout(namespace, 5);

        assertTrue(result.isPresent());
        assertEquals(layoutDoc, Document.parse(result.get()));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_empty_when_no_entry_matches_architecture() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = new Document("namespace", namespace)
                .append("layouts", List.of(new Document("architectureId", 99).append("layout", Document.parse(LAYOUT_JSON))));

        when(layoutCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

        Optional<String> result = layoutStore.getLayout(namespace, 5);

        assertFalse(result.isPresent());
    }

    @Test
    void return_empty_when_namespace_document_is_null() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(layoutCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

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
    void update_existing_entry_in_place_when_present() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult setResult = mock(UpdateResult.class);
        when(setResult.getModifiedCount()).thenReturn(1L);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(setResult);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        verify(layoutCollection, times(1)).updateOne(any(Bson.class), any(Bson.class));
        verify(layoutCollection, never()).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    @Test
    void push_new_entry_into_existing_namespace_document_when_none_matches() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult setResult = mock(UpdateResult.class);
        when(setResult.getModifiedCount()).thenReturn(0L);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(setResult);

        UpdateResult pushResult = mock(UpdateResult.class);
        when(pushResult.getModifiedCount()).thenReturn(1L);
        when(pushResult.getUpsertedId()).thenReturn(null);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class))).thenReturn(pushResult);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        verify(layoutCollection, times(1)).updateOne(any(Bson.class), any(Bson.class));
        verify(layoutCollection, times(1)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    @Test
    void insert_brand_new_namespace_document_via_upsert_when_none_exists() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult setResult = mock(UpdateResult.class);
        when(setResult.getModifiedCount()).thenReturn(0L);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(setResult);

        UpdateResult pushResult = mock(UpdateResult.class);
        when(pushResult.getUpsertedId()).thenReturn(new BsonObjectId(new ObjectId()));
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class))).thenReturn(pushResult);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        verify(layoutCollection, times(1)).updateOne(any(Bson.class), any(Bson.class));
        verify(layoutCollection, times(1)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    @Test
    void retry_set_once_when_both_the_set_and_the_conditional_push_lose_the_race() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult noOp = mock(UpdateResult.class);
        when(noOp.getModifiedCount()).thenReturn(0L);
        UpdateResult retrySucceeds = mock(UpdateResult.class);
        when(retrySucceeds.getModifiedCount()).thenReturn(1L);
        // First call (trySetExisting) misses, second call (the final retry) finds the
        // entry a concurrent writer just created and succeeds.
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(noOp, retrySucceeds);

        UpdateResult pushMiss = mock(UpdateResult.class);
        when(pushMiss.getModifiedCount()).thenReturn(0L);
        when(pushMiss.getUpsertedId()).thenReturn(null);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class))).thenReturn(pushMiss);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        // trySetExisting is attempted, then tryPushNew, then trySetExisting again as the final retry.
        verify(layoutCollection, times(2)).updateOne(any(Bson.class), any(Bson.class));
        verify(layoutCollection, times(1)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    @Test
    void fall_back_to_retrying_set_when_the_conditional_push_hits_a_duplicate_key_error() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult noOp = mock(UpdateResult.class);
        when(noOp.getModifiedCount()).thenReturn(0L);
        UpdateResult retrySucceeds = mock(UpdateResult.class);
        when(retrySucceeds.getModifiedCount()).thenReturn(1L);
        // First call (trySetExisting) misses, second call (the final retry, after the
        // duplicate-key race) finds the namespace document another writer just created.
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(noOp, retrySucceeds);

        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()));

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        verify(layoutCollection, times(2)).updateOne(any(Bson.class), any(Bson.class));
        verify(layoutCollection, times(1)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    @Test
    void throw_storage_write_exception_when_the_final_retry_also_finds_no_matching_entry() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        // Every trySetExisting attempt misses (including the final retry) — e.g. a
        // concurrent delete removed the entry again in that same window — so the save
        // must surface a failure rather than silently returning as if it had persisted.
        UpdateResult noOp = mock(UpdateResult.class);
        when(noOp.getModifiedCount()).thenReturn(0L);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(noOp);

        UpdateResult pushMiss = mock(UpdateResult.class);
        when(pushMiss.getModifiedCount()).thenReturn(0L);
        when(pushMiss.getUpsertedId()).thenReturn(null);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class))).thenReturn(pushMiss);

        assertThrows(StorageWriteException.class, () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));

        verify(layoutCollection, times(2)).updateOne(any(Bson.class), any(Bson.class));
        verify(layoutCollection, times(1)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    @Test
    void propagate_non_duplicate_key_errors_from_the_conditional_push() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult noOp = mock(UpdateResult.class);
        when(noOp.getModifiedCount()).thenReturn(0L);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(noOp);

        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(12, "some other error", new BsonDocument()), new ServerAddress(), List.of()));

        assertThrows(RuntimeException.class, () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));
    }

    @Test
    void throw_namespace_not_found_when_saving_layout_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));
        verify(layoutCollection, never()).updateOne(any(Bson.class), any(Bson.class));
        verify(layoutCollection, never()).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    // ---- deleteLayout ----

    @Test
    void delete_matching_entry_successfully() throws NamespaceNotFoundException, LayoutNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult pullResult = mock(UpdateResult.class);
        when(pullResult.getModifiedCount()).thenReturn(1L);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(pullResult);

        layoutStore.deleteLayout(namespace, 5);

        verify(layoutCollection, times(1)).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void throw_layout_not_found_when_delete_matches_nothing() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult pullResult = mock(UpdateResult.class);
        when(pullResult.getModifiedCount()).thenReturn(0L);
        when(layoutCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(pullResult);

        assertThrows(LayoutNotFoundException.class, () -> layoutStore.deleteLayout(namespace, 5));
    }

    @Test
    void throw_namespace_not_found_when_deleting_layout_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.deleteLayout(namespace, 5));
        verify(layoutCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    // ---- getArchitectureIdsWithLayoutForNamespace ----

    @Test
    void return_architecture_ids_with_saved_layouts() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = new Document("namespace", namespace)
                .append("layouts", List.of(
                        new Document("architectureId", 5).append("layout", Document.parse(LAYOUT_JSON)),
                        new Document("architectureId", 6).append("layout", Document.parse(LAYOUT_JSON))
                ));

        when(layoutCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

        List<Integer> ids = layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace);

        assertEquals(List.of(5, 6), ids);
    }

    @Test
    void return_empty_list_when_namespace_document_is_null_for_ids() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(layoutCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertTrue(layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace).isEmpty());
    }

    @Test
    void throw_namespace_not_found_when_listing_layout_ids_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace));
        verify(layoutCollection, never()).find(any(Bson.class));
    }
}
