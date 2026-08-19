package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.UpdateResult;
import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import org.bson.Document;
import org.bson.BsonDocument;
import org.bson.conversions.Bson;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestMongoDocumentStoreShould {
    private interface Documents extends MongoCollection<Document> { }
    private interface DocumentsFound extends FindIterable<Document> { }
    @Mock MongoDatabase database; @Mock MongoCounterStore counterStore; @Mock MongoNamespaceStore namespaceStore; @Mock Documents collection; @Mock DocumentsFound found;
    private MongoDocumentStore store;
    private final CreateDocumentRequest request = new CreateDocumentRequest("name", "description", "---\ntitle: A\n---\nbody");
    @BeforeEach void setUp() { when(database.getCollection("documents")).thenReturn(collection); when(namespaceStore.namespaceExists("finos")).thenReturn(true); when(collection.find(org.mockito.ArgumentMatchers.<Bson>any())).thenReturn(found); store = new MongoDocumentStore(database,counterStore,namespaceStore); }
    private Document root(String versions) { return new Document("documents", List.of(new Document("documentId", 7).append("name","name").append("description","description").append("versions", new Document("1-0-0", versions)))); }
    @Test void list_document_ids_and_get_document_versions() throws Exception { when(found.first()).thenReturn(root(request.getDocumentMarkdown())); assertThat(store.getDocumentsForNamespace("finos","pattern"),contains(7)); assertThat(store.getDocumentForVersion("finos","pattern",7,"1.0.0"),is(request.getDocumentMarkdown())); assertThrows(DocumentVersionNotFoundException.class,()->store.getDocumentForVersion("finos","pattern",7,"1.0.1")); }
    @Test void sort_document_ids_numerically() throws Exception { Document root = new Document("documents", List.of(new Document("documentId", 2), new Document("documentId", 1))); when(found.first()).thenReturn(root); assertThat(store.getDocumentsForNamespace("finos", "pattern"), contains(1, 2)); }
    @Test void normalize_and_sort_compact_numeric_versions() throws Exception { Document root = root(request.getDocumentMarkdown()); root.getList("documents", Document.class).getFirst().put("versions", new Document("1-0-0", request.getDocumentMarkdown()).append("2147483648-0-0", "large").append("1-0-10", "ten").append("1-0-2", "two")); when(found.first()).thenReturn(root); assertThat(store.getDocumentVersions("finos", "pattern", 7), contains("1.0.0", "1.0.2", "1.0.10", "2147483648.0.0")); assertThat(store.getDocumentForVersion("finos", "pattern", 7, "100"), is(request.getDocumentMarkdown())); }
    @Test void create_document_and_reject_compact_version_alias() throws Exception { when(found.first()).thenReturn(root(request.getDocumentMarkdown())); when(counterStore.getNextDocumentSequenceValue()).thenReturn(8); when(collection.updateOne(org.mockito.ArgumentMatchers.<Bson>any(), org.mockito.ArgumentMatchers.<Bson>any(), org.mockito.ArgumentMatchers.<UpdateOptions>any())).thenReturn(UpdateResult.acknowledged(1,1L,null)); assertThat(store.createDocumentForNamespace(request,"finos","pattern").getId(),is(8)); when(collection.updateOne(org.mockito.ArgumentMatchers.<Bson>any(), org.mockito.ArgumentMatchers.<Bson>any())).thenReturn(UpdateResult.acknowledged(0,0L,null)); assertThrows(DocumentVersionExistsException.class,()->store.createDocumentForVersion(request,"finos","pattern",7,"100")); }
    @Test void handle_missing_namespace_document_and_version() throws Exception { when(namespaceStore.namespaceExists("missing")).thenReturn(false); assertThrows(NamespaceNotFoundException.class, () -> store.getDocumentsForNamespace("missing", "pattern")); when(found.first()).thenReturn(null); assertThrows(DocumentNotFoundException.class, () -> store.getDocumentVersions("finos", "pattern", 7)); when(found.first()).thenReturn(root(request.getDocumentMarkdown())); assertThrows(DocumentVersionNotFoundException.class, () -> store.getDocumentForVersion("finos", "pattern", 7, "1.0.1")); }
    @Test void create_new_version_and_retry_duplicate_root_creation() throws Exception { when(found.first()).thenReturn(root(request.getDocumentMarkdown())); when(collection.updateOne(org.mockito.ArgumentMatchers.<Bson>any(), org.mockito.ArgumentMatchers.<Bson>any())).thenReturn(UpdateResult.acknowledged(1,1L,null)); assertThat(store.createDocumentForVersion(request, "finos", "pattern", 7, "1.0.1").getVersion(), is("1.0.1")); when(counterStore.getNextDocumentSequenceValue()).thenReturn(8); MongoWriteException duplicate = new MongoWriteException(new WriteError(11000, "duplicate", new BsonDocument()), new ServerAddress()); when(collection.updateOne(org.mockito.ArgumentMatchers.<Bson>any(), org.mockito.ArgumentMatchers.<Bson>any(), org.mockito.ArgumentMatchers.<UpdateOptions>any())).thenThrow(duplicate); assertThat(store.createDocumentForNamespace(request, "finos", "pattern").getId(), is(8)); }
}
