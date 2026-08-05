package org.finos.calm.store.nitrite;

import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.exception.LayoutNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestNitriteLayoutStoreShould {

    @Mock
    private Nitrite db;

    @Mock
    private NitriteCollection layoutCollection;

    @Mock
    private NitriteNamespaceStore namespaceStore;

    @Mock
    private DocumentCursor cursor;

    private NitriteLayoutStore layoutStore;

    private static final String LAYOUT_JSON = "{\"for\": \"/api/calm/namespaces/finos/architectures/5\", \"pins\": []}";

    @BeforeEach
    void setUp() {
        when(db.getCollection("layouts")).thenReturn(layoutCollection);
        layoutStore = new NitriteLayoutStore(db, namespaceStore);
    }

    // ---- getLayout ----

    @Test
    void return_layout_when_entry_exists() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("layouts", List.of(Document.createDocument("architectureId", 5).put("layout", LAYOUT_JSON)));

        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        Optional<String> result = layoutStore.getLayout(namespace, 5);

        assertTrue(result.isPresent());
        assertEquals(LAYOUT_JSON, result.get());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_empty_when_no_entry_matches_architecture() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("layouts", List.of(Document.createDocument("architectureId", 99).put("layout", LAYOUT_JSON)));

        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        assertFalse(layoutStore.getLayout(namespace, 5).isPresent());
    }

    @Test
    void return_empty_when_namespace_document_is_null() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        assertFalse(layoutStore.getLayout(namespace, 5).isPresent());
    }

    @Test
    void throw_namespace_not_found_when_getting_layout_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.getLayout(namespace, 5));
        verify(layoutCollection, never()).find(any(Filter.class));
    }

    // ---- upsertLayout ----

    @Test
    void insert_new_namespace_document_when_none_exists() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(layoutCollection).insert(captor.capture());
        Document inserted = captor.getValue();
        assertEquals(namespace, inserted.get("namespace"));
        @SuppressWarnings("unchecked")
        List<Document> layouts = (List<Document>) inserted.get("layouts");
        assertEquals(1, layouts.size());
        assertEquals(5, layouts.get(0).get("architectureId"));
        assertEquals(LAYOUT_JSON, layouts.get(0).get("layout"));
    }

    @Test
    void append_new_entry_to_existing_namespace_document() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document existingEntry = Document.createDocument("architectureId", 1).put("layout", "{\"pins\":[]}");
        Document existingNamespaceDoc = Document.createDocument("namespace", namespace)
                .put("layouts", List.of(existingEntry));

        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(existingNamespaceDoc);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        verify(layoutCollection).update(existingNamespaceDoc);
        @SuppressWarnings("unchecked")
        List<Document> layouts = (List<Document>) existingNamespaceDoc.get("layouts");
        assertEquals(2, layouts.size());
    }

    @Test
    void overwrite_existing_entry_for_the_same_architecture() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document existingEntry = Document.createDocument("architectureId", 5).put("layout", "{\"pins\":[]}");
        Document existingNamespaceDoc = Document.createDocument("namespace", namespace)
                .put("layouts", List.of(existingEntry));

        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(existingNamespaceDoc);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        verify(layoutCollection).update(existingNamespaceDoc);
        @SuppressWarnings("unchecked")
        List<Document> layouts = (List<Document>) existingNamespaceDoc.get("layouts");
        assertEquals(1, layouts.size());
        assertEquals(LAYOUT_JSON, layouts.get(0).get("layout"));
    }

    @Test
    void throw_json_parse_exception_when_layout_json_is_malformed() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        assertThrows(JsonParseException.class, () -> layoutStore.upsertLayout("finos", 5, "not-valid-json"));
        verify(layoutCollection, never()).insert(any(Document.class));
        verify(layoutCollection, never()).update(any(Document.class));
    }

    @Test
    void throw_json_parse_exception_when_layout_json_is_null() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        assertThrows(JsonParseException.class, () -> layoutStore.upsertLayout("finos", 5, null));
    }

    @Test
    void throw_namespace_not_found_when_saving_layout_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));
        verify(layoutCollection, never()).insert(any(Document.class));
        verify(layoutCollection, never()).update(any(Document.class));
    }

    // ---- deleteLayout ----

    @Test
    void delete_matching_entry_successfully() throws NamespaceNotFoundException, LayoutNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document entry = Document.createDocument("architectureId", 5).put("layout", LAYOUT_JSON);
        Document namespaceDocument = Document.createDocument("namespace", namespace).put("layouts", List.of(entry));

        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        layoutStore.deleteLayout(namespace, 5);

        verify(layoutCollection).update(namespaceDocument);
        @SuppressWarnings("unchecked")
        List<Document> remaining = (List<Document>) namespaceDocument.get("layouts");
        assertTrue(remaining.isEmpty());
    }

    @Test
    void throw_layout_not_found_when_namespace_document_is_null() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        assertThrows(LayoutNotFoundException.class, () -> layoutStore.deleteLayout(namespace, 5));
    }

    @Test
    void throw_layout_not_found_when_no_entry_matches_architecture() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document entry = Document.createDocument("architectureId", 99).put("layout", LAYOUT_JSON);
        Document namespaceDocument = Document.createDocument("namespace", namespace).put("layouts", List.of(entry));

        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        assertThrows(LayoutNotFoundException.class, () -> layoutStore.deleteLayout(namespace, 5));
    }

    @Test
    void throw_namespace_not_found_when_deleting_layout_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.deleteLayout(namespace, 5));
        verify(layoutCollection, never()).find(any(Filter.class));
    }

    // ---- getArchitectureIdsWithLayoutForNamespace ----

    @Test
    void return_architecture_ids_with_saved_layouts() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("layouts", List.of(
                        Document.createDocument("architectureId", 5).put("layout", LAYOUT_JSON),
                        Document.createDocument("architectureId", 6).put("layout", LAYOUT_JSON)
                ));

        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        List<Integer> ids = layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace);

        assertEquals(List.of(5, 6), ids);
    }

    @Test
    void return_empty_list_when_namespace_document_is_null_for_ids() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        assertTrue(layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace).isEmpty());
    }

    @Test
    void throw_namespace_not_found_when_listing_layout_ids_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.getArchitectureIdsWithLayoutForNamespace(namespace));
        verify(layoutCollection, never()).find(any(Filter.class));
    }
}
