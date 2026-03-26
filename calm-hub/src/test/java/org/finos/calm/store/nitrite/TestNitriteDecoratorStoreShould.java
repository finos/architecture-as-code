package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import org.finos.calm.domain.Decorator;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestNitriteDecoratorStoreShould {

    @Mock
    private Nitrite db;

    @Mock
    private NitriteCollection decoratorCollection;

    @Mock
    private NitriteNamespaceStore namespaceStore;

    @Mock
    private DocumentCursor cursor;

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
                .put("decorator", Document.createDocument("unique-id", "finos-architecture-1-deployment")
                        .put("type", "deployment")
                        .put("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0")));
        Document decorator2 = Document.createDocument("decoratorId", 2)
                .put("decorator", Document.createDocument("unique-id", "finos-architecture-1-deployment-v2")
                        .put("type", "deployment")
                        .put("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0")));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decorator1, decorator2));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(2, decoratorIds.size());
        assertTrue(decoratorIds.contains(1));
        assertTrue(decoratorIds.contains(2));
        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection).find(any(Filter.class));
    }

    @Test
    void should_filter_decorators_by_type() throws NamespaceNotFoundException {
        // Given
        String namespace = "workshop";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = Document.createDocument("decoratorId", 1)
                .put("decorator", Document.createDocument("type", "deployment")
                        .put("target", List.of("/calm/namespaces/workshop/architectures/1")));
        Document decorator2 = Document.createDocument("decoratorId", 2)
                .put("decorator", Document.createDocument("type", "observability")
                        .put("target", List.of("/calm/namespaces/workshop/architectures/1")));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decorator1, decorator2));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, "deployment");

        // Then
        assertNotNull(decoratorIds);
        assertEquals(1, decoratorIds.size());
        assertEquals(1, decoratorIds.get(0));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_filter_decorators_by_target() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        String targetPath = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = Document.createDocument("decoratorId", 1)
                .put("decorator", Document.createDocument("type", "deployment")
                        .put("target", List.of(targetPath)));
        Document decorator2 = Document.createDocument("decoratorId", 2)
                .put("decorator", Document.createDocument("type", "deployment")
                        .put("target", List.of(targetPath)));
        Document decorator3 = Document.createDocument("decoratorId", 3)
                .put("decorator", Document.createDocument("type", "deployment")
                        .put("target", List.of("/calm/namespaces/finos/patterns/1/versions/1-0-0")));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decorator1, decorator2, decorator3));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, targetPath, null);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(2, decoratorIds.size());
        assertTrue(decoratorIds.contains(1));
        assertTrue(decoratorIds.contains(2));
        assertFalse(decoratorIds.contains(3));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_filter_decorators_by_both_target_and_type() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        String targetPath = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = Document.createDocument("decoratorId", 1)
                .put("decorator", Document.createDocument("type", "deployment")
                        .put("target", List.of(targetPath)));
        Document decorator2 = Document.createDocument("decoratorId", 2)
                .put("decorator", Document.createDocument("type", "observability")
                        .put("target", List.of(targetPath)));
        Document decorator3 = Document.createDocument("decoratorId", 3)
                .put("decorator", Document.createDocument("type", "deployment")
                        .put("target", List.of("/calm/namespaces/finos/patterns/1/versions/1-0-0")));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decorator1, decorator2, decorator3));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, targetPath, "deployment");

        // Then
        assertNotNull(decoratorIds);
        assertEquals(1, decoratorIds.size());
        assertEquals(1, decoratorIds.get(0));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_return_empty_list_when_namespace_has_no_decorators() throws NamespaceNotFoundException {
        // Given
        String namespace = "empty-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of());

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

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

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

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
        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

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
            decoratorStore.getDecoratorsForNamespace(namespace, null, null);
        });

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection, never()).find(any(Filter.class));
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

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

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

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(1, decoratorIds.size());
        assertEquals(1, decoratorIds.get(0));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_return_decorator_by_id() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc = Document.createDocument("$schema", "https://calm.finos.org/draft/2025-03/meta/decorator.json")
                .put("unique-id", "finos-deployment-1")
                .put("type", "deployment")
                .put("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .put("target-type", List.of("architecture"))
                .put("applies-to", List.of("node-1"));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(
                        Document.createDocument("decoratorId", 1).put("decorator", decoratorDoc)
                ));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, 1);

        // Then
        assertTrue(result.isPresent());
        Decorator decorator = result.get();
        assertEquals("https://calm.finos.org/draft/2025-03/meta/decorator.json", decorator.getSchema());
        assertEquals("finos-deployment-1", decorator.getUniqueId());
        assertEquals("deployment", decorator.getType());
        assertEquals(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"), decorator.getTarget());
        assertEquals(List.of("architecture"), decorator.getTargetType());
        assertEquals(List.of("node-1"), decorator.getAppliesTo());
    }

    @Test
    void should_return_empty_optional_when_decorator_id_not_found() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(
                        Document.createDocument("decoratorId", 1).put("decorator", Document.createDocument("unique-id", "decorator-1"))
                ));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, 99);

        // Then
        assertFalse(result.isPresent());
    }

    @Test
    void should_return_empty_optional_from_get_by_id_when_namespace_document_is_null() throws NamespaceNotFoundException {
        // Given
        String namespace = "missing-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        // When
        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, 1);

        // Then
        assertFalse(result.isPresent());
    }

    @Test
    void should_throw_namespace_not_found_exception_from_get_by_id_when_namespace_does_not_exist() {
        // Given
        String namespace = "invalid-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        // When & Then
        assertThrows(NamespaceNotFoundException.class, () ->
                decoratorStore.getDecoratorById(namespace, 1));

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection, never()).find(any(Filter.class));
    }

    @Test
    void should_return_decorator_values_when_namespace_exists_with_decorators() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc1 = Document.createDocument("$schema", "https://calm.finos.org/draft/2025-03/meta/decorator.json")
                .put("unique-id", "finos-deployment-1")
                .put("type", "deployment")
                .put("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));
        Document decoratorDoc2 = Document.createDocument("$schema", "https://calm.finos.org/draft/2025-03/meta/decorator.json")
                .put("unique-id", "finos-observability-1")
                .put("type", "observability")
                .put("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(
                        Document.createDocument("decoratorId", 1).put("decorator", decoratorDoc1),
                        Document.createDocument("decoratorId", 2).put("decorator", decoratorDoc2)
                ));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Decorator> decorators = decoratorStore.getDecoratorValuesForNamespace(namespace, null, null);

        // Then
        assertNotNull(decorators);
        assertEquals(2, decorators.size());
        assertEquals("deployment", decorators.get(0).getType());
        assertEquals("observability", decorators.get(1).getType());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_filter_decorator_values_by_type() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc1 = Document.createDocument("type", "deployment")
                .put("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));
        Document decoratorDoc2 = Document.createDocument("type", "observability")
                .put("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(
                        Document.createDocument("decoratorId", 1).put("decorator", decoratorDoc1),
                        Document.createDocument("decoratorId", 2).put("decorator", decoratorDoc2)
                ));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Decorator> decorators = decoratorStore.getDecoratorValuesForNamespace(namespace, null, "deployment");

        // Then
        assertNotNull(decorators);
        assertEquals(1, decorators.size());
        assertEquals("deployment", decorators.get(0).getType());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_filter_decorator_values_by_target() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        String targetPath = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc1 = Document.createDocument("type", "deployment")
                .put("target", List.of(targetPath));
        Document decoratorDoc2 = Document.createDocument("type", "deployment")
                .put("target", List.of("/calm/namespaces/finos/patterns/1/versions/1-0-0"));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(
                        Document.createDocument("decoratorId", 1).put("decorator", decoratorDoc1),
                        Document.createDocument("decoratorId", 2).put("decorator", decoratorDoc2)
                ));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Decorator> decorators = decoratorStore.getDecoratorValuesForNamespace(namespace, targetPath, null);

        // Then
        assertNotNull(decorators);
        assertEquals(1, decorators.size());
        assertEquals(List.of(targetPath), decorators.get(0).getTarget());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_return_empty_list_of_values_when_namespace_has_no_decorators() throws NamespaceNotFoundException {
        // Given
        String namespace = "empty-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of());

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Decorator> decorators = decoratorStore.getDecoratorValuesForNamespace(namespace, null, null);

        // Then
        assertNotNull(decorators);
        assertTrue(decorators.isEmpty());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_return_empty_list_of_values_when_namespace_document_is_null() throws NamespaceNotFoundException {
        // Given
        String namespace = "missing-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        // When
        List<Decorator> decorators = decoratorStore.getDecoratorValuesForNamespace(namespace, null, null);

        // Then
        assertNotNull(decorators);
        assertTrue(decorators.isEmpty());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_throw_namespace_not_found_exception_for_get_values_when_namespace_does_not_exist() {
        // Given
        String namespace = "invalid-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        // When & Then
        assertThrows(NamespaceNotFoundException.class, () ->
                decoratorStore.getDecoratorValuesForNamespace(namespace, null, null));

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection, never()).find(any(Filter.class));
    }

    @Test
    void should_skip_decorator_values_with_null_decorator_id() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc1 = Document.createDocument("type", "deployment")
                .put("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));
        Document decoratorDoc3 = Document.createDocument("type", "observability")
                .put("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));

        Document namespaceDocument = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(
                        Document.createDocument("decoratorId", 1).put("decorator", decoratorDoc1),
                        Document.createDocument().put("decorator", Document.createDocument("type", "ignored")), // No decoratorId
                        Document.createDocument("decoratorId", 3).put("decorator", decoratorDoc3)
                ));

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Decorator> decorators = decoratorStore.getDecoratorValuesForNamespace(namespace, null, null);

        // Then
        assertEquals(2, decorators.size());
        assertEquals("deployment", decorators.get(0).getType());
        assertEquals("observability", decorators.get(1).getType());
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

        when(decoratorCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

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
