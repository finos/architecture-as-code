package org.finos.calm.store.nitrite;

import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Iterator;
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
class TestNitritePatternLayoutStoreShould {

    @Mock
    private Nitrite db;

    @Mock
    private NitriteCollection layoutCollection;

    @Mock
    private NitriteCollection patternHeaderCollection;

    @Mock
    private NitriteNamespaceStore namespaceStore;

    @Mock
    private DocumentCursor cursor;

    @Mock
    private DocumentCursor headerCursor;

    private NitritePatternLayoutStore layoutStore;

    private static final String LAYOUT_JSON = "{\"for\": \"/api/calm/namespaces/finos/patterns/5\", \"pins\": []}";

    @BeforeEach
    void setUp() {
        when(db.getCollection("pattern_layouts")).thenReturn(layoutCollection);
        when(db.getCollection("patterns")).thenReturn(patternHeaderCollection);
        layoutStore = new NitritePatternLayoutStore(db, namespaceStore);
    }

    /** Stubs the pattern-header existence check {@code upsertLayout} runs before writing. */
    private void stubPatternHeaderExists() {
        when(patternHeaderCollection.find(any(Filter.class))).thenReturn(headerCursor);
        when(headerCursor.firstOrNull()).thenReturn(Document.createDocument("patternId", 5));
    }

    // ---- getLayout ----

    @Test
    void return_layout_when_document_exists() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document document = Document.createDocument("namespace", namespace)
                .put("patternId", 5).put("layout", LAYOUT_JSON);

        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(document);

        Optional<String> result = layoutStore.getLayout(namespace, 5);

        assertTrue(result.isPresent());
        assertEquals(LAYOUT_JSON, result.get());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_empty_when_no_document_matches_pattern() throws NamespaceNotFoundException {
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
    void insert_a_new_document_when_none_exists_for_this_pattern()
            throws NamespaceNotFoundException, PatternNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        stubPatternHeaderExists();
        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(layoutCollection).insert(captor.capture());
        Document inserted = captor.getValue();
        assertEquals(namespace, inserted.get("namespace"));
        assertEquals(5, inserted.get("patternId"));
        assertEquals(LAYOUT_JSON, inserted.get("layout"));
    }

    @Test
    void insert_a_second_document_for_another_pattern_in_the_same_namespace()
            throws NamespaceNotFoundException, PatternNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        stubPatternHeaderExists();
        // find() is scoped to (namespace, patternId), so a document for a different pattern in
        // the same namespace never matches — insert, not update.
        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        layoutStore.upsertLayout(namespace, 6, LAYOUT_JSON);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(layoutCollection).insert(captor.capture());
        assertEquals(6, captor.getValue().get("patternId"));
    }

    @Test
    void update_the_existing_document_in_place() throws NamespaceNotFoundException, PatternNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        stubPatternHeaderExists();

        Document existing = Document.createDocument("namespace", namespace)
                .put("patternId", 5).put("layout", "{\"pins\":[]}");

        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(existing);

        layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON);

        verify(layoutCollection).update(existing);
        assertEquals(LAYOUT_JSON, existing.get("layout"));
    }

    @Test
    void throw_json_parse_exception_when_layout_json_is_malformed() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        stubPatternHeaderExists();

        assertThrows(JsonParseException.class, () -> layoutStore.upsertLayout("finos", 5, "not-valid-json"));
        verify(layoutCollection, never()).insert(any(Document.class));
        verify(layoutCollection, never()).update(any(Document.class));
    }

    @Test
    void throw_json_parse_exception_when_layout_json_is_null() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        stubPatternHeaderExists();

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

    @Test
    void throw_pattern_not_found_when_no_pattern_header_exists_for_the_target_id() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(patternHeaderCollection.find(any(Filter.class))).thenReturn(headerCursor);
        when(headerCursor.firstOrNull()).thenReturn(null);

        assertThrows(PatternNotFoundException.class, () -> layoutStore.upsertLayout(namespace, 5, LAYOUT_JSON));
        verify(layoutCollection, never()).insert(any(Document.class));
        verify(layoutCollection, never()).update(any(Document.class));
    }

    // ---- getPatternIdsWithLayoutForNamespace ----

    @Test
    void return_pattern_ids_with_saved_layouts() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document first = Document.createDocument("namespace", namespace).put("patternId", 5).put("layout", LAYOUT_JSON);
        Document second = Document.createDocument("namespace", namespace).put("patternId", 6).put("layout", LAYOUT_JSON);
        stubIterableCursor(List.of(first, second));

        List<Integer> ids = layoutStore.getPatternIdsWithLayoutForNamespace(namespace);

        assertEquals(List.of(5, 6), ids);
    }

    @Test
    void skip_a_document_with_no_pattern_id() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document noId = Document.createDocument("namespace", namespace).put("layout", LAYOUT_JSON);
        stubIterableCursor(List.of(noId));

        assertTrue(layoutStore.getPatternIdsWithLayoutForNamespace(namespace).isEmpty());
    }

    @Test
    void return_empty_list_when_no_layouts_exist_for_the_namespace() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        stubIterableCursor(List.of());

        assertTrue(layoutStore.getPatternIdsWithLayoutForNamespace(namespace).isEmpty());
    }

    @Test
    void throw_namespace_not_found_when_listing_layout_ids_in_unknown_namespace() {
        String namespace = "unknown";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> layoutStore.getPatternIdsWithLayoutForNamespace(namespace));
        verify(layoutCollection, never()).find(any(Filter.class));
    }

    /** Models the {@code DocumentCursor}'s plain-iteration path used by the ids listing. */
    private void stubIterableCursor(List<Document> documents) {
        when(layoutCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.iterator()).thenAnswer(invocation -> (Iterator<Document>) documents.iterator());
    }
}
