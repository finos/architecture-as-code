package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
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
class MongoDecoratorStoreTest {

    @Mock
    private MongoDatabase database;

    @Mock
    private MongoCollection<Document> decoratorCollection;

    @Mock
    private MongoNamespaceStore namespaceStore;

    @Mock
    private FindIterable<Document> findIterable;

    private MongoDecoratorStore decoratorStore;

    @BeforeEach
    void setUp() {
        when(database.getCollection("decorators")).thenReturn(decoratorCollection);
        decoratorStore = new MongoDecoratorStore(database, namespaceStore);
    }

    @Test
    void should_return_decorator_ids_when_namespace_exists_with_decorators() throws NamespaceNotFoundException {
        // Given
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decorator1 = new Document("decoratorId", 1)
                .append("decorator", new Document("unique-id", "finos-architecture-1-deployment"));
        Document decorator2 = new Document("decoratorId", 2)
                .append("decorator", new Document("unique-id", "finos-architecture-1-deployment-v2"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(decorator1, decorator2));

        when(decoratorCollection.find(any())).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of());

        when(decoratorCollection.find(any())).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document namespaceDocument = new Document("namespace", namespace);
        // No "decorators" field

        when(decoratorCollection.find(any())).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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
        when(decoratorCollection.find(any())).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace);

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

        when(decoratorCollection.find(any())).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(emptyDocument);

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

        Document decorator1 = new Document("decoratorId", 1)
                .append("decorator", new Document("unique-id", "decorator-1"));
        Document decorator2 = new Document() // No decoratorId
                .append("decorator", new Document("unique-id", "decorator-2"));
        Document decorator3 = new Document("decoratorId", 3)
                .append("decorator", new Document("unique-id", "decorator-3"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(decorator1, decorator2, decorator3));

        when(decoratorCollection.find(any())).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

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

        Document decorator = new Document("decoratorId", 1)
                .append("decorator", new Document("unique-id", "workshop-conference-deployment"));

        Document namespaceDocument = new Document("namespace", namespace)
                .append("decorators", List.of(decorator));

        when(decoratorCollection.find(any())).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDocument);

        // When
        List<Integer> decoratorIds = decoratorStore.getDecoratorsForNamespace(namespace);

        // Then
        assertNotNull(decoratorIds);
        assertEquals(1, decoratorIds.size());
        assertEquals(1, decoratorIds.get(0));
        verify(namespaceStore).namespaceExists(namespace);
    }
}
