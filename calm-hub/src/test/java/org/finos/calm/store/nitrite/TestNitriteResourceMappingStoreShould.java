package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.DuplicateMappingException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteResourceMappingStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    private NitriteResourceMappingStore store;

    private static final String NAMESPACE = "finos";

    @BeforeEach
    void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        store = new NitriteResourceMappingStore(mockDb, mockNamespaceStore);
    }

    // --- createMapping ---

    @Test
    void create_mapping_successfully() throws DuplicateMappingException, NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        ResourceMapping result = store.createMapping(NAMESPACE, "api-gateway", ResourceType.PATTERN, 1);

        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getCustomId(), is("api-gateway"));
        assertThat(result.getResourceType(), is(ResourceType.PATTERN));
        assertThat(result.getNumericId(), is(1));
        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    void throw_namespace_not_found_on_create_when_namespace_does_not_exist() {
        when(mockNamespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createMapping("invalid", "test", ResourceType.PATTERN, 1));
    }

    @Test
    void throw_duplicate_mapping_on_create_when_mapping_already_exists() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        Document existing = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "api-gateway")
                .put("resourceType", "PATTERN")
                .put("numericId", 1);
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(existing);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        assertThrows(DuplicateMappingException.class,
                () -> store.createMapping(NAMESPACE, "api-gateway", ResourceType.PATTERN, 1));
    }

    // --- getMapping ---

    @Test
    void get_mapping_successfully() throws MappingNotFoundException, NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document doc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "api-gateway")
                .put("resourceType", "PATTERN")
                .put("numericId", 42);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(doc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        ResourceMapping result = store.getMapping(NAMESPACE, "api-gateway");

        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getCustomId(), is("api-gateway"));
        assertThat(result.getResourceType(), is(ResourceType.PATTERN));
        assertThat(result.getNumericId(), is(42));
    }

    @Test
    void throw_mapping_not_found_when_no_document_exists() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        assertThrows(MappingNotFoundException.class,
                () -> store.getMapping(NAMESPACE, "nonexistent"));
    }

    @Test
    void throw_namespace_not_found_on_get_when_namespace_does_not_exist() {
        when(mockNamespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getMapping("invalid", "test"));
    }

    // --- listMappings ---

    @Test
    void list_all_mappings_for_namespace() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document doc1 = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "api-gateway")
                .put("resourceType", "PATTERN")
                .put("numericId", 1);
        Document doc2 = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "main-arch")
                .put("resourceType", "ARCHITECTURE")
                .put("numericId", 2);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(List.of(doc1, doc2).iterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<ResourceMapping> result = store.listMappings(NAMESPACE, null);

        assertThat(result, hasSize(2));
    }

    @Test
    void list_mappings_filtered_by_type() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document doc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "api-gateway")
                .put("resourceType", "PATTERN")
                .put("numericId", 1);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(List.of(doc).iterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<ResourceMapping> result = store.listMappings(NAMESPACE, ResourceType.PATTERN);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getResourceType(), is(ResourceType.PATTERN));
    }

    @Test
    void throw_namespace_not_found_on_list_when_namespace_does_not_exist() {
        when(mockNamespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.listMappings("invalid", null));
    }

    // --- getMappingByNumericId ---

    @Test
    void get_mapping_by_numeric_id_successfully() throws MappingNotFoundException, NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document doc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "api-gateway")
                .put("resourceType", "PATTERN")
                .put("numericId", 5);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(List.of(doc).iterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        ResourceMapping result = store.getMappingByNumericId(NAMESPACE, ResourceType.PATTERN, 5);

        assertThat(result.getCustomId(), is("api-gateway"));
        assertThat(result.getNumericId(), is(5));
    }

    @Test
    void throw_mapping_not_found_on_get_by_numeric_id_when_no_mapping_exists() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(Collections.emptyIterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        assertThrows(MappingNotFoundException.class,
                () -> store.getMappingByNumericId(NAMESPACE, ResourceType.PATTERN, 999));
    }

    // --- listMappingsByNumericIds ---

    @Test
    void list_mappings_by_numeric_ids() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document doc1 = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "pattern-a")
                .put("resourceType", "PATTERN")
                .put("numericId", 1);
        Document doc2 = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "pattern-b")
                .put("resourceType", "PATTERN")
                .put("numericId", 2);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(List.of(doc1, doc2).iterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<ResourceMapping> result = store.listMappingsByNumericIds(NAMESPACE, ResourceType.PATTERN, List.of(1, 2));

        assertThat(result, hasSize(2));
    }

    @Test
    void list_mappings_by_numeric_ids_filters_non_matching() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document doc1 = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "pattern-a")
                .put("resourceType", "PATTERN")
                .put("numericId", 1);
        Document doc2 = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "pattern-b")
                .put("resourceType", "PATTERN")
                .put("numericId", 2);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(List.of(doc1, doc2).iterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<ResourceMapping> result = store.listMappingsByNumericIds(NAMESPACE, ResourceType.PATTERN, List.of(1));

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getCustomId(), is("pattern-a"));
    }

    // --- updateMappingNumericId ---

    @Test
    void update_mapping_numeric_id_successfully() throws MappingNotFoundException, NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document existing = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "api-gateway")
                .put("resourceType", "PATTERN")
                .put("numericId", 0);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(existing);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        store.updateMappingNumericId(NAMESPACE, "api-gateway", 99);

        verify(mockCollection).update(any(Document.class));
    }

    @Test
    void throw_namespace_not_found_on_update_numeric_id_when_namespace_does_not_exist() {
        when(mockNamespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.updateMappingNumericId("invalid", "test", 1));
    }

    @Test
    void throw_mapping_not_found_on_update_numeric_id_when_mapping_does_not_exist() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        assertThrows(MappingNotFoundException.class,
                () -> store.updateMappingNumericId(NAMESPACE, "nonexistent", 1));
    }

    // --- deleteMapping ---

    @Test
    void delete_mapping_successfully() throws MappingNotFoundException, NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document existing = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("customId", "api-gateway")
                .put("resourceType", "PATTERN")
                .put("numericId", 1);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(existing);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        store.deleteMapping(NAMESPACE, "api-gateway");

        verify(mockCollection).remove(existing);
    }

    @Test
    void throw_namespace_not_found_on_delete_when_namespace_does_not_exist() {
        when(mockNamespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.deleteMapping("invalid", "test"));
    }

    @Test
    void throw_mapping_not_found_on_delete_when_mapping_does_not_exist() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        assertThrows(MappingNotFoundException.class,
                () -> store.deleteMapping(NAMESPACE, "nonexistent"));
    }
}
