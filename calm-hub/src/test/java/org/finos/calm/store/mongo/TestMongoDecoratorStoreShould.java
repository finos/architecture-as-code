package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.UpdateResult;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestMongoDecoratorStoreShould {

    @Mock
    private MongoDatabase database;

    @Mock
    private MongoCollection<Document> decoratorCollection;

    @Mock
    private MongoNamespaceStore namespaceStore;

    @Mock
    private MongoCounterStore counterStore;

    @Mock
    private FindIterable<Document> findIterable;

    private MongoDecoratorStore decoratorStore;

    @BeforeEach
    void setUp() {
        when(database.getCollection("decorators")).thenReturn(decoratorCollection);
        decoratorStore = new MongoDecoratorStore(database, namespaceStore, counterStore);
    }

    @Test
    void should_return_decorator_ids_when_namespace_exists_with_decorators() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = new Document("decoratorId", 1)
                .append("decorator", new Document("unique-id", "finos-architecture-1-deployment")
                        .append("type", "deployment")
                        .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0")));
        Document decorator2 = new Document("decoratorId", 2)
                .append("decorator", new Document("unique-id", "finos-architecture-1-deployment-v2")
                        .append("type", "deployment")
                        .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0")));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(decorator1, decorator2));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(2, decoratorIds.size());
        assertTrue(decoratorIds.contains(1));
        assertTrue(decoratorIds.contains(2));
        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection).find(any(Bson.class));
    }

    @Test
    void should_filter_decorators_by_type() throws NamespaceNotFoundException {
        // Given
        String namespace = "workshop";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = new Document("decoratorId", 1)
                .append("decorator", new Document("type", "deployment")
                        .append("target", List.of("/calm/namespaces/workshop/architectures/1")));
        Document decorator2 = new Document("decoratorId", 2)
                .append("decorator", new Document("type", "observability")
                        .append("target", List.of("/calm/namespaces/workshop/architectures/1")));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(decorator1, decorator2));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document decorator1 = new Document("decoratorId", 1)
                .append("decorator", new Document("type", "deployment")
                        .append("target", List.of(targetPath)));
        Document decorator2 = new Document("decoratorId", 2)
                .append("decorator", new Document("type", "deployment")
                        .append("target", List.of(targetPath)));
        Document decorator3 = new Document("decoratorId", 3)
                .append("decorator", new Document("type", "deployment")
                        .append("target", List.of("/calm/namespaces/finos/patterns/1/versions/1-0-0")));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(decorator1, decorator2, decorator3));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document decorator1 = new Document("decoratorId", 1)
                .append("decorator", new Document("type", "deployment")
                        .append("target", List.of(targetPath)));
        Document decorator2 = new Document("decoratorId", 2)
                .append("decorator", new Document("type", "observability")
                        .append("target", List.of(targetPath)));
        Document decorator3 = new Document("decoratorId", 3)
                .append("decorator", new Document("type", "deployment")
                        .append("target", List.of("/calm/namespaces/finos/patterns/1/versions/1-0-0")));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(decorator1, decorator2, decorator3));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of());

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document namespaceDocument = new Document("namespace", namespace);
        // No "decorators" field

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

        // Then
        assertNotNull(decoratorIds);
        assertTrue(decoratorIds.isEmpty());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_return_empty_list_when_namespace_document_is_empty() throws NamespaceNotFoundException {
        // Given
        String namespace = "empty-doc-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document emptyDocument = new Document();

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(emptyDocument);

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
        verify(decoratorCollection, never()).find(any(Bson.class));
    }

    @Test
    void should_return_decorator_by_id() throws NamespaceNotFoundException, DecoratorNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc = new Document("$schema", "https://calm.finos.org/draft/2025-03/meta/decorator.json")
                .append("unique-id", "finos-deployment-1")
                .append("type", "deployment")
                .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .append("target-type", List.of("architecture"))
                .append("applies-to", List.of("node-1"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(
                        new Document("decoratorId", 1).append("decorator", decoratorDoc)
                ));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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
    void should_return_empty_optional_when_decorator_id_not_found() throws NamespaceNotFoundException, DecoratorNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(
                        new Document("decoratorId", 1).append("decorator", new Document("unique-id", "decorator-1"))
                ));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

        // When
        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, 99);

        // Then
        assertFalse(result.isPresent());
    }

    @Test
    void should_return_empty_optional_from_get_by_id_when_namespace_document_is_null() throws NamespaceNotFoundException, DecoratorNotFoundException {
        // Given
        String namespace = "missing-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

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
        verify(decoratorCollection, never()).find(any(Bson.class));
    }

    @Test
    void should_return_decorator_values_when_namespace_exists_with_decorators() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc1 = new Document("$schema", "https://calm.finos.org/draft/2025-03/meta/decorator.json")
                .append("unique-id", "finos-deployment-1")
                .append("type", "deployment")
                .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));
        Document decoratorDoc2 = new Document("$schema", "https://calm.finos.org/draft/2025-03/meta/decorator.json")
                .append("unique-id", "finos-observability-1")
                .append("type", "observability")
                .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(
                        new Document("decoratorId", 1).append("decorator", decoratorDoc1),
                        new Document("decoratorId", 2).append("decorator", decoratorDoc2)
                ));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document decoratorDoc1 = new Document("type", "deployment")
                .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));
        Document decoratorDoc2 = new Document("type", "observability")
                .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(
                        new Document("decoratorId", 1).append("decorator", decoratorDoc1),
                        new Document("decoratorId", 2).append("decorator", decoratorDoc2)
                ));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document decoratorDoc1 = new Document("type", "deployment")
                .append("target", List.of(targetPath));
        Document decoratorDoc2 = new Document("type", "deployment")
                .append("target", List.of("/calm/namespaces/finos/patterns/1/versions/1-0-0"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(
                        new Document("decoratorId", 1).append("decorator", decoratorDoc1),
                        new Document("decoratorId", 2).append("decorator", decoratorDoc2)
                ));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of());

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

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
        verify(decoratorCollection, never()).find(any(Bson.class));
    }

    @Test
    void should_skip_decorators_with_null_decorator_id() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = new Document("decoratorId", 1)
                .append("decorator", new Document("unique-id", "decorator-1"));
        Document decorator2 = new Document() // No decoratorId
                .append("decorator", new Document("unique-id", "decorator-2"));
        Document decorator3 = new Document("decoratorId", 3)
                .append("decorator", new Document("unique-id", "decorator-3"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(decorator1, decorator2, decorator3));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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
    void should_create_decorator_and_return_assigned_id() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(42);

        String decoratorJson = "{\"unique-id\": \"test-decorator\", \"type\": \"deployment\"}";

        // When
        int id = decoratorStore.createDecorator(namespace, decoratorJson);

        // Then
        assertEquals(42, id);
        verify(namespaceStore).namespaceExists(namespace);
        verify(counterStore).getNextDecoratorSequenceValue();
        verify(decoratorCollection).updateOne(any(Bson.class), any(Bson.class), any());
    }

    @Test
    void should_throw_namespace_not_found_when_creating_decorator_in_unknown_namespace() {
        // Given
        String namespace = "unknown-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        String decoratorJson = "{\"unique-id\": \"test\", \"type\": \"test\"}";

        // When & Then
        assertThrows(NamespaceNotFoundException.class,
                () -> decoratorStore.createDecorator(namespace, decoratorJson));

        verify(namespaceStore).namespaceExists(namespace);
        verify(counterStore, never()).getNextDecoratorSequenceValue();
        verify(decoratorCollection, never()).updateOne(any(Bson.class), any(Bson.class), any());
    }

    @Test
    void should_skip_decorator_values_with_null_decorator_id() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc1 = new Document("type", "deployment")
                .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));
        Document decoratorDoc3 = new Document("type", "observability")
                .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(
                        new Document("decoratorId", 1).append("decorator", decoratorDoc1),
                        new Document().append("decorator", new Document("type", "ignored")), // No decoratorId
                        new Document("decoratorId", 3).append("decorator", decoratorDoc3)
                ));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

        // When
        List<Decorator> decorators = decoratorStore.getDecoratorValuesForNamespace(namespace, null, null);

        // Then
        assertEquals(2, decorators.size());
        assertEquals("deployment", decorators.get(0).getType());
        assertEquals("observability", decorators.get(1).getType());
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_handle_single_decorator() throws NamespaceNotFoundException {
        // Given
        String namespace = "workshop";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator = new Document("decoratorId", 1)
                .append("decorator", new Document("unique-id", "workshop-conference-deployment"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(decorator));

        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace, null, null);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(1, decoratorIds.size());
        assertEquals(1, decoratorIds.get(0));
        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void should_update_decorator_successfully() throws NamespaceNotFoundException, DecoratorNotFoundException {
        // Given
        String namespace = "finos";
        int decoratorId = 1;
        String decoratorJson = "{\"unique-id\": \"updated-decorator\", \"type\": \"deployment\"}";

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(1L);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(updateResult);

        // When / Then (no exception)
        decoratorStore.updateDecorator(namespace, decoratorId, decoratorJson);

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void should_throw_decorator_not_found_when_update_matches_nothing() {
        // Given
        String namespace = "finos";
        int decoratorId = 99;
        String decoratorJson = "{\"unique-id\": \"does-not-exist\", \"type\": \"deployment\"}";

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(0L);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(updateResult);

        // When & Then
        assertThrows(DecoratorNotFoundException.class,
                () -> decoratorStore.updateDecorator(namespace, decoratorId, decoratorJson));

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void should_throw_namespace_not_found_when_updating_decorator_in_unknown_namespace() {
        // Given
        String namespace = "unknown-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        String decoratorJson = "{\"unique-id\": \"test\", \"type\": \"test\"}";

        // When & Then
        assertThrows(NamespaceNotFoundException.class,
                () -> decoratorStore.updateDecorator(namespace, 1, decoratorJson));

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }
}
