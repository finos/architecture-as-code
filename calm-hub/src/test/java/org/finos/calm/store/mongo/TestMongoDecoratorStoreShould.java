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
import org.bson.BsonBinaryWriter;
import org.bson.BsonSerializationException;
import org.bson.Document;
import org.bson.codecs.DocumentCodec;
import org.bson.codecs.EncoderContext;
import org.bson.io.BasicOutputBuffer;
import org.bson.conversions.Bson;
import org.bson.json.JsonParseException;
import org.bson.types.Decimal128;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;
import java.util.Map;

import org.finos.calm.domain.Decorator;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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
    void setUp() throws NamespaceNotFoundException {
        lenient().doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        when(database.getCollection("decorators")).thenReturn(decoratorCollection);
        lenient().when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
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

        Document decoratorDoc = new Document("$schema", "https://calm.finos.org/release/1.3/meta/decorators.json")
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
        assertEquals("https://calm.finos.org/release/1.3/meta/decorators.json", decorator.getSchema());
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

        Document decoratorDoc1 = new Document("$schema", "https://calm.finos.org/release/1.3/meta/decorators.json")
                .append("unique-id", "finos-deployment-1")
                .append("type", "deployment")
                .append("target", List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"));
        Document decoratorDoc2 = new Document("$schema", "https://calm.finos.org/release/1.3/meta/decorators.json")
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
    void retry_and_succeed_when_a_concurrent_request_wins_the_first_create_race() throws NamespaceNotFoundException {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(42);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()))
                .thenReturn(null);

        decoratorStore.createDecorator(namespace, "{\"unique-id\": \"test-decorator\", \"type\": \"deployment\"}");

        verify(decoratorCollection, times(2)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    @Test
    void map_non_duplicate_key_errors_when_creating_a_decorator() {
        String namespace = "finos";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(42);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(new MongoWriteException(new WriteError(12, "some other error", new BsonDocument()), new ServerAddress(), List.of()));

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.createDecorator(namespace, "{\"unique-id\": \"test-decorator\", \"type\": \"deployment\"}"));
        assertFalse(e.isCapacityExceeded());
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
    void should_update_decorator_successfully() throws Exception {
        // Given
        String namespace = "finos";
        int decoratorId = 1;
        String decoratorJson = "{\"unique-id\": \"updated-decorator\", \"type\": \"deployment\"}";

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getMatchedCount()).thenReturn(1L);
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
        when(updateResult.getMatchedCount()).thenReturn(0L);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(updateResult);

        // When & Then
        assertThrows(DecoratorNotFoundException.class,
                () -> decoratorStore.updateDecorator(namespace, decoratorId, decoratorJson));

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void should_throw_decorator_superseded_when_an_in_place_update_finds_a_superseded_entry() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getMatchedCount()).thenReturn(0L);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(updateResult);
        ArgumentCaptor<Bson> anyEntry = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.countDocuments(anyEntry.capture())).thenReturn(1L);

        assertThrows(DecoratorSupersededException.class,
                () -> decoratorStore.updateDecorator("finos", 1, "{\"type\": \"deployment\"}"));

        BsonDocument withId = anyEntry.getValue().toBsonDocument().getArray("$and").get(1)
                .asDocument().getDocument("decorators").getDocument("$elemMatch");
        assertEquals(1, withId.getInt32("decoratorId").getValue());
        assertFalse(withId.containsKey("supersededBy"));
    }

    @Test
    void should_update_an_entry_that_matched_even_if_nothing_changed() throws Exception {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getMatchedCount()).thenReturn(1L);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(updateResult);

        decoratorStore.updateDecorator("finos", 1, "{\"type\": \"deployment\"}");

        verify(decoratorCollection, never()).countDocuments(any(Bson.class));
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

    @Test
    void should_delete_decorator_successfully() throws Exception {
        // Given
        String namespace = "finos";
        int decoratorId = 1;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        mockNamespaceDocument(namespace, new Document("decoratorId", 1).append("decorator", new Document("type", "deployment")));

        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(1L);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(updateResult);

        // When
        decoratorStore.deleteCurrentDecoratorHistory(namespace, decoratorId);

        // Then
        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void should_throw_decorator_not_found_when_delete_matches_nothing() {
        // Given
        String namespace = "finos";
        int decoratorId = 99;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        mockNamespaceDocument(namespace, new Document("decoratorId", 99).append("decorator", new Document("type", "deployment")));

        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(0L);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(updateResult);

        // When & Then
        assertThrows(DecoratorNotFoundException.class,
                () -> decoratorStore.deleteCurrentDecoratorHistory(namespace, decoratorId));

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void should_throw_namespace_not_found_when_deleting_decorator_in_unknown_namespace() {
        // Given
        String namespace = "unknown-namespace";
        when(namespaceStore.namespaceExists(namespace)).thenReturn(false);

        // When & Then
        assertThrows(NamespaceNotFoundException.class,
                () -> decoratorStore.deleteCurrentDecoratorHistory(namespace, 1));

        verify(namespaceStore).namespaceExists(namespace);
        verify(decoratorCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void should_throw_decorator_not_found_without_writing_when_delete_finds_no_decorator() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThrows(DecoratorNotFoundException.class, () -> decoratorStore.deleteCurrentDecoratorHistory("finos", 1));

        verify(decoratorCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void should_delete_the_whole_history_of_a_decorator() throws Exception {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos", supersededEntry(1, 2), currentEntry(2, 1), currentEntry(3, null));
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(1L);
        ArgumentCaptor<Bson> update = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.updateOne(any(Bson.class), update.capture())).thenReturn(updateResult);

        decoratorStore.deleteCurrentDecoratorHistory("finos", 2);

        assertEquals(List.of(2, 1), update.getValue().toBsonDocument()
                .getDocument("$pull").getDocument("decorators").getDocument("decoratorId")
                .getArray("$in").stream().map(value -> value.asInt32().getValue()).toList());
    }

    @Test
    void should_require_the_authorized_head_to_still_be_current_when_deleting() throws Exception {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos", supersededEntry(1, 2), currentEntry(2, 1));
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(0L);
        ArgumentCaptor<Bson> filter = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.updateOne(filter.capture(), any(Bson.class))).thenReturn(updateResult);

        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);

        assertThrows(DecoratorSupersededException.class, () -> decoratorStore.deleteCurrentDecoratorHistory("finos", 1));

        BsonDocument current = filter.getValue().toBsonDocument().getArray("$and").get(1)
                .asDocument().getDocument("decorators").getDocument("$elemMatch");
        assertEquals(1, current.getArray("$and").getFirst().asDocument().getInt32("decoratorId").getValue());
        assertEquals(false, current.getArray("$and").get(1).asDocument()
                .getDocument("supersededBy").getBoolean("$exists").getValue());
    }

    @Test
    void should_throw_decorator_not_found_when_a_current_delete_loses_to_another_delete() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(
                new Document("namespace", "finos").append("decorators", List.of(currentEntry(1, null))));
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(0L);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(updateResult);

        assertThrows(DecoratorNotFoundException.class, () -> decoratorStore.deleteCurrentDecoratorHistory("finos", 1));
    }

    @Test
    void should_decode_a_decorator_stored_with_wrong_field_types() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos", new Document("decoratorId", 1).append("decorator",
                new Document("type", 5).append("target", "t").append("applies-to", List.of("a", 2))
                        .append("target-type", List.of("architecture")).append("unique-id", 7)));

        Decorator decorator = decoratorStore.getDecoratorById("finos", 1).orElseThrow();

        assertNull(decorator.getType());
        assertNull(decorator.getTarget());
        assertNull(decorator.getAppliesTo());
        assertNull(decorator.getUniqueId());
        assertEquals(List.of("architecture"), decorator.getTargetType());
    }

    @Test
    void should_read_decimal128_data_as_jdk_numbers() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos", new Document("decoratorId", 1).append("decorator", new Document("type", "deployment")
                .append("data", new Document("big", Decimal128.parse("123456789012345678901234567890"))
                        .append("exponent", Decimal128.parse("1E+3"))
                        .append("decimal", Decimal128.parse("1.50"))
                        .append("negativeZero", Decimal128.NEGATIVE_ZERO)
                        .append("nan", Decimal128.NaN)
                        .append("small", 3)
                        .append("nested", new Document("n", Decimal128.parse("7")))
                        .append("list", List.of(Decimal128.parse("8"), "text")))));

        Map<?, ?> data = (Map<?, ?>) decoratorStore.getDecoratorById("finos", 1).orElseThrow().getData();

        assertEquals(new BigInteger("123456789012345678901234567890"), data.get("big"));
        assertEquals(BigInteger.valueOf(1000), data.get("exponent"));
        assertEquals(new BigDecimal("1.50"), data.get("decimal"));
        assertEquals(BigDecimal.ZERO, data.get("negativeZero"));
        assertEquals(Decimal128.NaN, data.get("nan"));
        assertEquals(3, data.get("small"));
        assertEquals(BigInteger.valueOf(7), ((Map<?, ?>) data.get("nested")).get("n"));
        assertEquals(List.of(BigInteger.valueOf(8), "text"), data.get("list"));
    }

    @Test
    void should_read_a_decorator_with_no_data() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos", new Document("decoratorId", 1).append("decorator", new Document("type", "deployment")));

        assertNull(decoratorStore.getDecoratorById("finos", 1).orElseThrow().getData());
    }

    @Test
    void should_filter_past_a_decorator_stored_with_wrong_field_types() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos",
                new Document("decoratorId", 1).append("decorator", new Document("type", 5).append("target", "t")),
                currentEntry(2, null).append("decorator", new Document("type", "deployment").append("target", List.of("t"))));

        assertEquals(List.of(2), decoratorStore.getDecoratorsForNamespace("finos", "t", "deployment"));
    }

    @Test
    void should_delete_a_decorator_stored_with_wrong_field_types() throws Exception {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos", new Document("decoratorId", 1).append("decorator", new Document("type", 5).append("target", "t")));
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(1L);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(updateResult);

        decoratorStore.deleteCurrentDecoratorHistory("finos", 1);

        verify(decoratorCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void should_leave_superseded_decorators_out_of_lists() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos", supersededEntry(1, 2), currentEntry(2, 1));

        assertEquals(List.of(2), decoratorStore.getDecoratorsForNamespace("finos", null, null));
        assertEquals(List.of("eval-2"), decoratorStore.getDecoratorValuesForNamespace("finos", null, null).stream()
                .map(Decorator::getUniqueId).toList());
    }

    @Test
    void should_supersede_a_current_decorator() throws Exception {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(1L);
        when(decoratorCollection.updateOne(any(Bson.class), anyList())).thenReturn(updateResult);

        int newId = decoratorStore.supersedeDecorator("finos", 1, "{\"type\": \"control-evaluation\"}");

        assertEquals(5, newId);
        verify(decoratorCollection).updateOne(any(Bson.class), argThat((List<? extends Bson> pipeline) -> {
            BsonDocument stage = pipeline.getFirst().toBsonDocument();
            var arrays = stage.getDocument("$set").getDocument("decorators").getArray("$concatArrays");
            BsonDocument pushed = arrays.get(1).asDocument().getArray("$literal").getFirst().asDocument();
            assertEquals(5, pushed.getInt32("decoratorId").getValue());
            assertEquals(1, pushed.getInt32("supersedes").getValue());
            assertEquals("control-evaluation", pushed.getDocument("decorator").getString("type").getValue());
            assertEquals(5, arrays.getFirst().asDocument().getDocument("$map").getDocument("in")
                    .getArray("$cond").get(1).asDocument().getArray("$mergeObjects").get(1)
                    .asDocument().getInt32("supersededBy").getValue());
            return true;
        }));
    }

    @Test
    void should_throw_decorator_superseded_without_taking_an_id_when_superseding_an_old_decorator() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(0L, 1L);

        assertThrows(DecoratorSupersededException.class,
                () -> decoratorStore.supersedeDecorator("finos", 1, "{\"type\": \"control-evaluation\"}"));

        verify(counterStore, never()).getNextDecoratorSequenceValue();
        verify(decoratorCollection, never()).updateOne(any(Bson.class), anyList());
    }

    @Test
    void should_throw_decorator_not_found_without_taking_an_id_when_superseding_a_missing_decorator() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(0L, 0L);

        assertThrows(DecoratorNotFoundException.class,
                () -> decoratorStore.supersedeDecorator("finos", 1, "{\"type\": \"control-evaluation\"}"));

        verify(counterStore, never()).getNextDecoratorSequenceValue();
    }

    @Test
    void should_throw_decorator_superseded_when_a_supersede_loses_the_race_to_another() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L, 1L);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(0L);
        when(decoratorCollection.updateOne(any(Bson.class), anyList())).thenReturn(updateResult);

        assertThrows(DecoratorSupersededException.class,
                () -> decoratorStore.supersedeDecorator("finos", 1, "{\"type\": \"control-evaluation\"}"));
    }

    @Test
    void should_throw_namespace_not_found_when_superseding_in_an_unknown_namespace() {
        when(namespaceStore.namespaceExists("unknown")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> decoratorStore.supersedeDecorator("unknown", 1, "{}"));

        verify(decoratorCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void should_return_the_history_of_a_decorator_current_first() throws Exception {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos", supersededEntry(1, 2), currentEntry(2, 1), currentEntry(3, null));

        List<DecoratorHistoryEntry> history = decoratorStore.getDecoratorHistory("finos", 1);

        assertEquals(List.of(2, 1), history.stream().map(DecoratorHistoryEntry::getId).toList());
        assertEquals(1, history.get(0).getSupersedes());
        assertEquals(2, history.get(1).getSupersededBy());
        assertEquals("eval-1", history.get(1).getDecorator().getUniqueId());
    }

    @Test
    void should_throw_decorator_not_found_for_the_history_of_a_missing_decorator() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThrows(DecoratorNotFoundException.class, () -> decoratorStore.getDecoratorHistory("finos", 1));
    }

    @Test
    void should_store_extended_json_keys_as_plain_data_on_create() throws Exception {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(1);
        ArgumentCaptor<Bson> update = ArgumentCaptor.forClass(Bson.class);

        decoratorStore.createDecorator("finos", EXTENDED_JSON_DECORATOR);

        verify(decoratorCollection).updateOne(any(Bson.class), update.capture(), any(UpdateOptions.class));
        assertStoredAsPlainData(update.getValue().toBsonDocument()
                .getDocument("$push").getDocument("decorators").getDocument("decorator"));
    }

    @Test
    void should_store_extended_json_keys_as_plain_data_on_update() throws Exception {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getMatchedCount()).thenReturn(1L);
        ArgumentCaptor<Bson> update = ArgumentCaptor.forClass(Bson.class);
        when(decoratorCollection.updateOne(any(Bson.class), update.capture())).thenReturn(updateResult);

        decoratorStore.updateDecorator("finos", 1, EXTENDED_JSON_DECORATOR);

        assertStoredAsPlainData(update.getValue().toBsonDocument()
                .getDocument("$set").getDocument("decorators.$.decorator"));
    }

    @Test
    void should_store_extended_json_keys_as_plain_data_on_supersede() throws Exception {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(1L);
        when(decoratorCollection.updateOne(any(Bson.class), anyList())).thenReturn(updateResult);

        decoratorStore.supersedeDecorator("finos", 1, EXTENDED_JSON_DECORATOR);

        verify(decoratorCollection).updateOne(any(Bson.class), argThat((List<? extends Bson> pipeline) -> {
            BsonDocument successor = pipeline.getFirst().toBsonDocument().getDocument("$set").getDocument("decorators")
                    .getArray("$concatArrays").get(1).asDocument().getArray("$literal").getFirst().asDocument();
            assertStoredAsPlainData(successor.getDocument("decorator"));
            return true;
        }));
    }

    @Test
    void should_refuse_decorator_json_that_is_not_an_object() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        assertThrows(JsonParseException.class, () -> decoratorStore.createDecorator("finos", "[1]"));
        assertThrows(JsonParseException.class, () -> decoratorStore.createDecorator("finos", "null"));
        verify(decoratorCollection, never()).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }


    @Test
    void map_a_too_large_namespace_document_to_the_capacity_error_on_create() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(42);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class))).thenThrow(tooLarge());

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.createDecorator("finos", "{\"type\": \"deployment\"}"));
        assertTrue(e.isCapacityExceeded());
    }

    @Test
    void map_a_too_large_namespace_document_to_the_capacity_error_on_update() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenThrow(tooLarge());

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.updateDecorator("finos", 1, "{\"type\": \"deployment\"}"));
        assertTrue(e.isCapacityExceeded());
        verify(decoratorCollection, never()).countDocuments(any(Bson.class));
    }

    @Test
    void map_a_too_large_namespace_document_to_the_capacity_error_on_supersede() {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        when(decoratorCollection.updateOne(any(Bson.class), anyList())).thenThrow(tooLarge());

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.supersedeDecorator("finos", 1, "{\"type\": \"control-evaluation\"}"));
        assertTrue(e.isCapacityExceeded());
    }

    @Test
    void map_other_write_errors_to_a_write_failure_on_supersede() {
        when(decoratorCollection.countDocuments(any(Bson.class))).thenReturn(1L);
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(5);
        when(decoratorCollection.updateOne(any(Bson.class), anyList()))
                .thenThrow(new MongoWriteException(new WriteError(12, "some other error", new BsonDocument()), new ServerAddress(), List.of()));

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.supersedeDecorator("finos", 1, "{\"type\": \"control-evaluation\"}"));
        assertFalse(e.isCapacityExceeded());
    }

    @Test
    void map_a_write_error_on_delete() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        mockNamespaceDocument("finos", currentEntry(1, null));
        when(decoratorCollection.updateOne(any(Bson.class), any(Bson.class))).thenThrow(tooLarge());

        StorageWriteException e = assertThrows(StorageWriteException.class,
                () -> decoratorStore.deleteCurrentDecoratorHistory("finos", 1));
        assertTrue(e.isCapacityExceeded());
    }

    private static MongoWriteException tooLarge() {
        return new MongoWriteException(new WriteError(10334, "BSONObjectTooLarge", new BsonDocument()), new ServerAddress(), List.of());
    }

    @Test
    void refuse_a_key_with_a_nul_character_before_it_takes_an_id() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        DecoratorKeyRefusedException e = assertThrows(DecoratorKeyRefusedException.class,
                () -> decoratorStore.createDecorator("finos", NUL_KEY_DECORATOR));

        assertEquals(DecoratorKeyRefusedException.nulCharacter().getMessage(), e.getMessage());
        verify(counterStore, never()).getNextDecoratorSequenceValue();
        verify(decoratorCollection, never()).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    @Test
    void refuse_a_key_with_a_nul_character_on_update_and_supersede() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        assertThrows(DecoratorKeyRefusedException.class, () -> decoratorStore.updateDecorator("finos", 1, NUL_KEY_DECORATOR));
        assertThrows(DecoratorKeyRefusedException.class, () -> decoratorStore.supersedeDecorator("finos", 1, NUL_KEY_DECORATOR));

        verify(decoratorCollection, never()).updateOne(any(Bson.class), any(Bson.class));
        verify(decoratorCollection, never()).updateOne(any(Bson.class), anyList());
        verify(counterStore, never()).getNextDecoratorSequenceValue();
    }

    @Test
    void keep_a_nul_character_in_a_value() throws Exception {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(counterStore.getNextDecoratorSequenceValue()).thenReturn(1);
        ArgumentCaptor<Bson> update = ArgumentCaptor.forClass(Bson.class);

        decoratorStore.createDecorator("finos", "{\"data\": {\"key\": \"a\\u0000b\"}}");

        verify(decoratorCollection).updateOne(any(Bson.class), update.capture(), any(UpdateOptions.class));
        assertEquals("a\0b", update.getValue().toBsonDocument().getDocument("$push").getDocument("decorators")
                .getDocument("decorator").getDocument("data").getString("key").getValue());
    }

    @Test
    void need_the_nul_check_because_the_driver_cannot_encode_such_a_key() {
        BsonBinaryWriter writer = new BsonBinaryWriter(new BasicOutputBuffer());

        assertThrows(BsonSerializationException.class,
                () -> new DocumentCodec().encode(writer, new Document("a\0b", 1), EncoderContext.builder().build()));
    }

    @Test
    void allow_a_write_because_mongo_can_write() {
        assertDoesNotThrow(() -> decoratorStore.requireWritable());
    }

    private static final String NUL_KEY_DECORATOR = "{\"type\": \"deployment\", \"data\": {\"list\": [{\"a\\u0000b\": 1}]}}";
    private static final String EXTENDED_JSON_DECORATOR = """
            {"type": "deployment", "data": {"n": {"$numberInt": "1"}, "k": {"$maxKey": 1},
             "list": [{"$numberLong": "2"}], "big": 123456789012345678901234567890,
             "negative": -123456789012345678901234567890, "huge": 1234567890123456789012345678901234567890, "small": 3}}
            """;

    private static void assertStoredAsPlainData(BsonDocument decorator) {
        BsonDocument data = decorator.getDocument("data");
        assertEquals("1", data.getDocument("n").getString("$numberInt").getValue());
        assertEquals(1, data.getDocument("k").getInt32("$maxKey").getValue());
        assertEquals("2", data.getArray("list").getFirst().asDocument().getString("$numberLong").getValue());
        assertEquals(Decimal128.parse("123456789012345678901234567890"), data.getDecimal128("big").getValue());
        assertEquals(Decimal128.parse("-123456789012345678901234567890"), data.getDecimal128("negative").getValue());
        assertEquals(1.2345678901234568E39, data.getDouble("huge").getValue());
        assertEquals(3, data.getInt32("small").getValue());
    }

    private void mockNamespaceDocument(String namespace, Document... decorators) {
        when(decoratorCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(new Document("namespace", namespace).append("decorators", List.of(decorators)));
    }

    private static Document currentEntry(int id, Integer supersedes) {
        Document entry = new Document("decoratorId", id)
                .append("decorator", new Document("unique-id", "eval-" + id).append("type", "control-evaluation"));
        return supersedes == null ? entry : entry.append("supersedes", supersedes);
    }

    private static Document supersededEntry(int id, int supersededBy) {
        return currentEntry(id, null).append("supersededBy", supersededBy);
    }
}
