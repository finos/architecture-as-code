package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Optional;

import static org.dizitart.no2.filters.FluentFilter.where;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.when;

class NitriteDecoratorStoreTest {

    @Mock
    private Nitrite db;

    @Mock
    private NitriteCollection decoratorCollection;

    @Mock
    private org.dizitart.no2.collection.DocumentCursor cursor;

    @Mock
    private NitriteNamespaceStore namespaceStore;

    @InjectMocks
    private NitriteDecoratorStore decoratorStore;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(db.getCollection(anyString())).thenReturn(decoratorCollection);
        decoratorStore = new NitriteDecoratorStore(db, namespaceStore);
    }

    @Test
    void testGetDecoratorById_Success() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc = Document.createDocument("decoratorId", decoratorId)
                .put("decorator", Document.createDocument("target", List.of("test-target")).put("type", "test-type"));
        Document namespaceDoc = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decoratorDoc));

        when(decoratorCollection.find(where("namespace").eq(namespace))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);

        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, decoratorId);

        assertTrue(result.isPresent());
        assertEquals(List.of("test-target"), result.get().getTarget());
        assertEquals("test-type", result.get().getType());
        assertNull(result.get().getTargetType());
        assertNull(result.get().getAppliesTo());
    }

    @Test
    void testGetDecoratorById_NotFound() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 99;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc = Document.createDocument("decoratorId", 1)
                .put("decorator", Document.createDocument("target", List.of("test-target")).put("type", "test-type"));
        Document namespaceDoc = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decoratorDoc));

        when(decoratorCollection.find(where("namespace").eq(namespace))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);

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
    void testGetDecoratorById_NullNamespaceDocument() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(decoratorCollection.find(where("namespace").eq(namespace))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(null);

        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, decoratorId);

        assertFalse(result.isPresent());
    }

    @Test
    void testGetDecoratorById_EmptyDecoratorsList() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document namespaceDoc = Document.createDocument("namespace", namespace)
                .put("decorators", List.of());

        when(decoratorCollection.find(where("namespace").eq(namespace))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);

        Optional<Decorator> result = decoratorStore.getDecoratorById(namespace, decoratorId);

        assertFalse(result.isPresent());
    }

    @Test
    void testGetDecoratorById_MapsAllFields() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        Document decoratorDoc = Document.createDocument("decoratorId", decoratorId)
                .put("decorator", Document.createDocument("$schema", "https://calm.finos.org/schemas/2024-01/decorator.json")
                        .put("unique-id", "test-decorator-1")
                        .put("type", "deployment")
                        .put("target", List.of("arch-1"))
                        .put("target-type", List.of("architecture"))
                        .put("applies-to", List.of("node-1"))
                        .put("data", Document.createDocument("key", "value")));
        Document namespaceDoc = Document.createDocument("namespace", namespace)
                .put("decorators", List.of(decoratorDoc));

        when(decoratorCollection.find(where("namespace").eq(namespace))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);

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
