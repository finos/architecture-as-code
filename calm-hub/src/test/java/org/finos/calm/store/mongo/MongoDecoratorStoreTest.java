package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.FindIterable;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MongoDecoratorStoreTest {

    @Mock
    private MongoDatabase database;

    @Mock
    private MongoCollection<Document> decoratorCollection;

    @Mock
    private MongoNamespaceStore namespaceStore;

    @Mock
    private MongoCounterStore counterStore;

    @InjectMocks
    private MongoDecoratorStore decoratorStore;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(database.getCollection(anyString())).thenReturn(decoratorCollection);
        decoratorStore = new MongoDecoratorStore(database, namespaceStore, counterStore);
    }

    @Test
    void testGetDecoratorById_Success() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc = new Document("decoratorId", decoratorId)
                .append("decorator", new Document("target", List.of("test-target")).append("type", "test-type"));
        Document namespaceDoc = new Document("namespace", namespace)
                .append("decorators", List.of(decoratorDoc));

        FindIterable<Document> findIterable = mock(FindIterable.class);
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDoc);

        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, decoratorId);

        assertTrue(result.isPresent());
        assertTrue(result.get().getTarget().contains("test-target"));
        assertEquals("test-type", result.get().getType());
        assertNull(result.get().getTargetType());
        assertNull(result.get().getAppliesTo());
    }

    @Test
    void testGetDecoratorById_NotFound() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 99;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc = new Document("decoratorId", 1)
                .append("decorator", new Document("target", List.of("test-target")).append("type", "test-type"));
        Document namespaceDoc = new Document("namespace", namespace)
                .append("decorators", List.of(decoratorDoc));

        FindIterable<Document> findIterable = mock(FindIterable.class);
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDoc);

        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, decoratorId);

        assertFalse(result.isPresent());
    }

    @Test
    void testGetDecoratorById_NamespaceNotFound() {
        String namespace = "non-existent-namespace";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> decoratorStore.getDecoratorById(namespace, decoratorId));
    }

    @Test
    void testGetDecoratorById_EmptyNamespaceDocument() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        FindIterable<Document> findIterable = mock(FindIterable.class);
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(new Document());

        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, decoratorId);

        assertFalse(result.isPresent());
    }

    @Test
    void testGetDecoratorById_EmptyDecoratorsList() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDoc = new Document("namespace", namespace)
                .append("decorators", List.of());

        FindIterable<Document> findIterable = mock(FindIterable.class);
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDoc);

        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, decoratorId);

        assertFalse(result.isPresent());
    }

    @Test
    void testGetDecoratorById_MapsAllFields() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc = new Document("decoratorId", decoratorId)
                .append("decorator", new Document("$schema", "https://calm.finos.org/schemas/2024-01/decorator.json")
                        .append("unique-id", "test-decorator-1")
                        .append("type", "deployment")
                        .append("target", List.of("arch-1"))
                        .append("target-type", List.of("architecture"))
                        .append("applies-to", List.of("node-1"))
                        .append("data", new Document("key", "value")));
        Document namespaceDoc = new Document("namespace", namespace)
                .append("decorators", List.of(decoratorDoc));

        FindIterable<Document> findIterable = mock(FindIterable.class);
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(namespaceDoc);

        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, decoratorId);

        assertTrue(result.isPresent());
        Decorator decorator = result.get();
        assertEquals("https://calm.finos.org/schemas/2024-01/decorator.json", decorator.getSchema());
        assertEquals("test-decorator-1", decorator.getUniqueId());
        assertEquals("deployment", decorator.getType());
        assertEquals(List.of("arch-1"), decorator.getTarget());
        assertEquals(List.of("architecture"), decorator.getTargetType());
        assertEquals(List.of("node-1"), decorator.getAppliesTo());
        assertNotNull(decorator.getData());
    }
}
