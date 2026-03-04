package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.FindPlan;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.common.Lookup;
import org.dizitart.no2.common.RecordStream;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NitriteDecoratorStoreTest {

    @Mock
    private Nitrite db;

    @Mock
    private NitriteCollection decoratorCollection;

    @Mock
    private NitriteNamespaceStore namespaceStore;

    @Mock
    private RecordStream<Document> recordStream;

    private NitriteDecoratorStore decoratorStore;

    @BeforeEach
    void setUp() {
        when(db.getCollection("decorators")).thenReturn(decoratorCollection);
        decoratorStore = new NitriteDecoratorStore(db, namespaceStore);
    }

    @Test
    void should_return_decorator_ids_when_namespace_exists_with_decorators() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = Document.createDocument("decoratorId", 1)
                .put("decorator", Document.createDocument("unique-id", "finos-architecture-1-deployment"));
        Document decorator2 = Document.createDocument("decoratorId", 2)
                .put("decorator", Document.createDocument("unique-id", "finos-architecture-1-deployment-v2"));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decorator1, decorator2));

        when(decoratorCollection.find(any())).thenReturn(recordStream);
        when(recordStream.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(2, decoratorIds.size());
        assertTrue(decoratorIds.contains(1));
        assertTrue(decoratorIds.contains(2));
        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection).find(any());
    }

    @Test
    void should_return_empty_list_when_namespace_has_no_decorators() throws NamespaceNotFoundException {
        // Given
        String namespace = "empty-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of());

        when(decoratorCollection.find(any())).thenReturn(recordStream);
        when(recordStream.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace);

        // Then
        assertNotNull(decoratorIds);
        assertTrue(decoratorIds.isEmpty());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_return_empty_list_when_decorators_field_is_null() throws NamespaceNotFoundException {
        // Given
        String namespace = "test-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = Document.createDocument("namespace", namespace);
        // No "decorators" field

        when(decoratorCollection.find(any())).thenReturn(recordStream);
        when(recordStream.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace);

        // Then
        assertNotNull(decoratorIds);
        assertTrue(decoratorIds.isEmpty());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_return_empty_list_when_namespace_document_is_null() throws NamespaceNotFoundException {
        // Given
        String namespace = "missing-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(decoratorCollection.find(any())).thenReturn(recordStream);
        when(recordStream.firstOrNull()).thenReturn(null);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace);

        // Then
        assertNotNull(decoratorIds);
        assertTrue(decoratorIds.isEmpty());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_throw_namespace_not_found_exception_when_namespace_does_not_exist() {
        // Given
        String namespace = "invalid-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        // When & Then
        assertThrows(NamespaceNotFoundException.class, () -> {
            decoratorStore.getDecoratorsForNamespace(namespace);
        });

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection, never()).find(any());
    }

    @Test
    void should_skip_decorators_with_null_decorator_id() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = Document.createDocument("decoratorId", 1)
                .put("decorator", Document.createDocument("unique-id", "decorator-1"));
        Document decorator2 = Document.createDocument() // No decoratorId
                .put("decorator", Document.createDocument("unique-id", "decorator-2"));
        Document decorator3 = Document.createDocument("decoratorId", 3)
                .put("decorator", Document.createDocument("unique-id", "decorator-3"));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decorator1, decorator2, decorator3));

        when(decoratorCollection.find(any())).thenReturn(recordStream);
        when(recordStream.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(2, decoratorIds.size());
        assertTrue(decoratorIds.contains(1));
        assertTrue(decoratorIds.contains(3));
        assertFalse(decoratorIds.contains(null));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_handle_single_decorator() throws NamespaceNotFoundException {
        // Given
        String namespace = "workshop";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator = Document.createDocument("decoratorId", 1)
                .put("decorator", Document.createDocument("unique-id", "workshop-conference-deployment"));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decorator));

        when(decoratorCollection.find(any())).thenReturn(recordStream);
        when(recordStream.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(1, decoratorIds.size());
        assertEquals(1, decoratorIds.get(0));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_log_initialization_message() {
        // Given/When - setUp already called
        
        // Then
        verify(db).getCollection("decorators");
        // Logger message is logged but we can't easily verify it in unit tests
        // This test mainly verifies the constructor completes successfully
    }

    @Test
    void should_handle_multiple_decorators_in_order() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = Document.createDocument("decoratorId", 5)
                .put("decorator", Document.createDocument("unique-id", "decorator-5"));
        Document decorator2 = Document.createDocument("decoratorId", 10)
                .put("decorator", Document.createDocument("unique-id", "decorator-10"));
        Document decorator3 = Document.createDocument("decoratorId", 1)
                .put("decorator", Document.createDocument("unique-id", "decorator-1"));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decorator1, decorator2, decorator3));

        when(decoratorCollection.find(any())).thenReturn(recordStream);
        when(recordStream.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(3, decoratorIds.size());
        // Verify order is maintained
        assertEquals(5, decoratorIds.get(0));
        assertEquals(10, decoratorIds.get(1));
        assertEquals(1, decoratorIds.get(2));
        verify(namespaceStore).namespaceExists(namespace);
    }
}
