package org.finos.calm.store.mongo;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.DuplicateMappingException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestMongoResourceMappingStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private MongoResourceMappingStore store;
    private MongoCollection<Document> mappingCollection;

    @BeforeEach
    void setup() throws NamespaceNotFoundException {
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        mappingCollection = Mockito.mock(DocumentMongoCollection.class);
        when(mongoDatabase.getCollection("resource_mappings")).thenReturn(mappingCollection);
        store = new MongoResourceMappingStore(mongoDatabase, namespaceStore);
    }

    // --- createMapping ---

    @Test
    void create_mapping_successfully() throws DuplicateMappingException, NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        ResourceMapping result = store.createMapping("finos", "api-gateway", ResourceType.PATTERN, 1);

        assertThat(result.getNamespace(), is("finos"));
        assertThat(result.getCustomId(), is("api-gateway"));
        assertThat(result.getResourceType(), is(ResourceType.PATTERN));
        assertThat(result.getNumericId(), is(1));
        verify(mappingCollection).insertOne(any(Document.class));
    }

    @Test
    void create_mapping_with_same_custom_id_as_a_different_resource_type() throws DuplicateMappingException, NamespaceNotFoundException {
        // The store itself performs no in-memory duplicate check on create — uniqueness is
        // enforced by MongoDB's (namespace, resourceType, customId) unique index (see
        // MongoIndexInitializationStep / MongoResourceMappingIndexStep). This asserts the
        // document written for each type carries the correct resourceType, so the same
        // customId ("repo") can be stored once per type without this store layer blocking it.
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        store.createMapping("finos", "repo", ResourceType.PATTERN, 1);
        store.createMapping("finos", "repo", ResourceType.ARCHITECTURE, 1);

        ArgumentCaptor<Document> insertCaptor = ArgumentCaptor.forClass(Document.class);
        verify(mappingCollection, times(2)).insertOne(insertCaptor.capture());

        List<Document> inserted = insertCaptor.getAllValues();
        assertThat(inserted.get(0).getString("customId"), is("repo"));
        assertThat(inserted.get(0).getString("resourceType"), is("PATTERN"));
        assertThat(inserted.get(1).getString("customId"), is("repo"));
        assertThat(inserted.get(1).getString("resourceType"), is("ARCHITECTURE"));
    }

    @Test
    void throw_namespace_not_found_on_create_when_namespace_does_not_exist() {
        when(namespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.createMapping("invalid", "test", ResourceType.PATTERN, 1));
    }

    @Test
    void throw_duplicate_mapping_on_create_when_unique_index_violated() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        WriteError writeError = new WriteError(11000, "duplicate key", new BsonDocument());
        MongoWriteException duplicateKeyException = new MongoWriteException(writeError, new ServerAddress());
        doThrow(duplicateKeyException).when(mappingCollection).insertOne(any(Document.class));

        assertThrows(DuplicateMappingException.class,
                () -> store.createMapping("finos", "api-gateway", ResourceType.PATTERN, 1));
    }

    // --- getMapping ---

    @Test
    void get_mapping_successfully() throws MappingNotFoundException, NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        Document doc = new Document("namespace", "finos")
                .append("customId", "api-gateway")
                .append("resourceType", "PATTERN")
                .append("numericId", 42);

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(mappingCollection.find(any(org.bson.conversions.Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(doc);

        ResourceMapping result = store.getMapping("finos", ResourceType.PATTERN, "api-gateway");

        assertThat(result.getNamespace(), is("finos"));
        assertThat(result.getCustomId(), is("api-gateway"));
        assertThat(result.getResourceType(), is(ResourceType.PATTERN));
        assertThat(result.getNumericId(), is(42));
    }

    @Test
    void throw_mapping_not_found_when_no_document_exists() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(mappingCollection.find(any(org.bson.conversions.Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThrows(MappingNotFoundException.class,
                () -> store.getMapping("finos", ResourceType.PATTERN, "nonexistent"));
    }

    @Test
    void throw_namespace_not_found_on_get_when_namespace_does_not_exist() {
        when(namespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getMapping("invalid", ResourceType.PATTERN, "test"));
    }

    @Test
    void scope_get_mapping_query_by_resource_type() throws MappingNotFoundException, NamespaceNotFoundException {
        // Regression guard for #2970: a customId lookup must be scoped by resourceType, or a
        // pattern and an architecture sharing a customId (e.g. "repo") collide.
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        Document doc = new Document("namespace", "finos")
                .append("customId", "repo")
                .append("resourceType", "ARCHITECTURE")
                .append("numericId", 1);

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        ArgumentCaptor<Bson> filterCaptor = ArgumentCaptor.forClass(Bson.class);
        when(mappingCollection.find(filterCaptor.capture())).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(doc);

        store.getMapping("finos", ResourceType.ARCHITECTURE, "repo");

        String filterJson = filterCaptor.getValue().toBsonDocument().toJson();
        assertThat(filterJson, containsString("\"resourceType\": \"ARCHITECTURE\""));
        assertThat(filterJson, containsString("\"customId\": \"repo\""));
    }

    // --- listMappings ---

    @Test
    void list_all_mappings_for_namespace() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        Document doc1 = new Document("namespace", "finos")
                .append("customId", "api-gateway")
                .append("resourceType", "PATTERN")
                .append("numericId", 1);
        Document doc2 = new Document("namespace", "finos")
                .append("customId", "main-arch")
                .append("resourceType", "ARCHITECTURE")
                .append("numericId", 2);

        MongoCursor<Document> cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, true, false);
        when(cursor.next()).thenReturn(doc1, doc2);

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(mappingCollection.find(any(org.bson.conversions.Bson.class))).thenReturn(findIterable);
        when(findIterable.iterator()).thenReturn(cursor);

        List<ResourceMapping> result = store.listMappings("finos", null);

        assertThat(result, hasSize(2));
    }

    @Test
    void list_mappings_filtered_by_type() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        Document doc = new Document("namespace", "finos")
                .append("customId", "api-gateway")
                .append("resourceType", "PATTERN")
                .append("numericId", 1);

        MongoCursor<Document> cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(doc);

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(mappingCollection.find(any(org.bson.conversions.Bson.class))).thenReturn(findIterable);
        when(findIterable.iterator()).thenReturn(cursor);

        List<ResourceMapping> result = store.listMappings("finos", ResourceType.PATTERN);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getResourceType(), is(ResourceType.PATTERN));
    }

    @Test
    void throw_namespace_not_found_on_list_when_namespace_does_not_exist() {
        when(namespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.listMappings("invalid", null));
    }

    // --- getMappingByNumericId ---

    @Test
    void get_mapping_by_numeric_id_successfully() throws MappingNotFoundException, NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        Document doc = new Document("namespace", "finos")
                .append("customId", "api-gateway")
                .append("resourceType", "PATTERN")
                .append("numericId", 5);

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(mappingCollection.find(any(org.bson.conversions.Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(doc);

        ResourceMapping result = store.getMappingByNumericId("finos", ResourceType.PATTERN, 5);

        assertThat(result.getCustomId(), is("api-gateway"));
        assertThat(result.getNumericId(), is(5));
    }

    @Test
    void throw_mapping_not_found_on_get_by_numeric_id_when_no_mapping_exists() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(mappingCollection.find(any(org.bson.conversions.Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThrows(MappingNotFoundException.class,
                () -> store.getMappingByNumericId("finos", ResourceType.PATTERN, 999));
    }

    // --- listMappingsByNumericIds ---

    @Test
    void list_mappings_by_numeric_ids() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        Document doc1 = new Document("namespace", "finos")
                .append("customId", "pattern-a")
                .append("resourceType", "PATTERN")
                .append("numericId", 1);
        Document doc2 = new Document("namespace", "finos")
                .append("customId", "pattern-b")
                .append("resourceType", "PATTERN")
                .append("numericId", 2);

        MongoCursor<Document> cursor = Mockito.mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, true, false);
        when(cursor.next()).thenReturn(doc1, doc2);

        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(mappingCollection.find(any(org.bson.conversions.Bson.class))).thenReturn(findIterable);
        when(findIterable.iterator()).thenReturn(cursor);

        List<ResourceMapping> result = store.listMappingsByNumericIds("finos", ResourceType.PATTERN, List.of(1, 2));

        assertThat(result, hasSize(2));
    }

    // --- updateMappingNumericId ---

    @Test
    void update_mapping_numeric_id_successfully() throws MappingNotFoundException, NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        var updateResult = Mockito.mock(com.mongodb.client.result.UpdateResult.class);
        when(updateResult.getMatchedCount()).thenReturn(1L);
        when(mappingCollection.updateOne(any(org.bson.conversions.Bson.class), any(Document.class))).thenReturn(updateResult);

        store.updateMappingNumericId("finos", ResourceType.PATTERN, "api-gateway", 42);

        verify(mappingCollection).updateOne(any(org.bson.conversions.Bson.class), any(Document.class));
    }

    @Test
    void throw_mapping_not_found_on_update_when_no_matching_document() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        var updateResult = Mockito.mock(com.mongodb.client.result.UpdateResult.class);
        when(updateResult.getMatchedCount()).thenReturn(0L);
        when(mappingCollection.updateOne(any(org.bson.conversions.Bson.class), any(Document.class))).thenReturn(updateResult);

        assertThrows(MappingNotFoundException.class,
                () -> store.updateMappingNumericId("finos", ResourceType.PATTERN, "nonexistent", 42));
    }

    @Test
    void throw_namespace_not_found_on_update_when_namespace_does_not_exist() {
        when(namespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.updateMappingNumericId("invalid", ResourceType.PATTERN, "test", 42));
    }

    // --- deleteMapping ---

    @Test
    void delete_mapping_successfully() throws MappingNotFoundException, NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        var deleteResult = Mockito.mock(com.mongodb.client.result.DeleteResult.class);
        when(deleteResult.getDeletedCount()).thenReturn(1L);
        when(mappingCollection.deleteOne(any(org.bson.conversions.Bson.class))).thenReturn(deleteResult);

        store.deleteMapping("finos", ResourceType.PATTERN, "api-gateway");

        verify(mappingCollection).deleteOne(any(org.bson.conversions.Bson.class));
    }

    @Test
    void throw_mapping_not_found_on_delete_when_no_matching_document() {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        var deleteResult = Mockito.mock(com.mongodb.client.result.DeleteResult.class);
        when(deleteResult.getDeletedCount()).thenReturn(0L);
        when(mappingCollection.deleteOne(any(org.bson.conversions.Bson.class))).thenReturn(deleteResult);

        assertThrows(MappingNotFoundException.class,
                () -> store.deleteMapping("finos", ResourceType.PATTERN, "nonexistent"));
    }

    @Test
    void throw_namespace_not_found_on_delete_when_namespace_does_not_exist() {
        when(namespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.deleteMapping("invalid", ResourceType.PATTERN, "test"));
    }

    // --- deleteMappingByNumericId ---

    @Test
    void delete_mapping_by_numeric_id_successfully() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        var deleteResult = Mockito.mock(com.mongodb.client.result.DeleteResult.class);
        when(deleteResult.getDeletedCount()).thenReturn(1L);
        when(mappingCollection.deleteOne(any(org.bson.conversions.Bson.class))).thenReturn(deleteResult);

        store.deleteMappingByNumericId("finos", ResourceType.PATTERN, 42);

        verify(mappingCollection).deleteOne(any(org.bson.conversions.Bson.class));
    }

    @Test
    void not_throw_when_deleting_a_mapping_by_numeric_id_that_does_not_exist() throws NamespaceNotFoundException {
        // Most resources have no custom-id mapping at all — this must be a silent no-op, not
        // an error, so a resource delete can call it unconditionally.
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        var deleteResult = Mockito.mock(com.mongodb.client.result.DeleteResult.class);
        when(deleteResult.getDeletedCount()).thenReturn(0L);
        when(mappingCollection.deleteOne(any(org.bson.conversions.Bson.class))).thenReturn(deleteResult);

        store.deleteMappingByNumericId("finos", ResourceType.PATTERN, 999);

        verify(mappingCollection).deleteOne(any(org.bson.conversions.Bson.class));
    }

    @Test
    void throw_namespace_not_found_when_deleting_a_mapping_by_numeric_id_in_a_missing_namespace() {
        when(namespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.deleteMappingByNumericId("invalid", ResourceType.PATTERN, 42));
    }

    // --- Helper interfaces for Mockito generics ---

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentMongoCursor extends MongoCursor<Document> {
    }
}
