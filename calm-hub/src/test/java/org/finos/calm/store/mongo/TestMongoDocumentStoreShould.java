package org.finos.calm.store.mongo;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mongodb.client.FindIterable;
import com.mongodb.client.model.Filters;
import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.UpdateResult;
import org.bson.Document;
import org.bson.BsonDocument;
import org.bson.conversions.Bson;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.function.Consumer;

class TestMongoDocumentStoreShould {

    private interface DocumentCollection extends MongoCollection<Document> {}
    private interface DocumentIterable extends FindIterable<Document> {}

    private final CreateDocumentRequest request =
            new CreateDocumentRequest("name", "description", "---\r\ntitle: A\r\n---\r\nbody");
    private MongoCounterStore counterStore;
    private MongoNamespaceStore namespaceStore;
    private MongoCollection<Document> headers;
    private MongoCollection<Document> versions;
    private FindIterable<Document> headerFind;
    private FindIterable<Document> versionFind;
    private MongoDocumentStore store;

    @BeforeEach
    void setup() {
        MongoDatabase database = mock(MongoDatabase.class);
        counterStore = mock(MongoCounterStore.class);
        namespaceStore = mock(MongoNamespaceStore.class);
        headers = mock(DocumentCollection.class);
        versions = mock(DocumentCollection.class);
        headerFind = mock(DocumentIterable.class);
        versionFind = mock(DocumentIterable.class);
        when(database.getCollection("documents")).thenReturn(headers);
        when(database.getCollection("documentVersions")).thenReturn(versions);
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);
        when(headers.find(any(Bson.class))).thenReturn(headerFind);
        when(versions.find(any(Bson.class))).thenReturn(versionFind);
        when(headerFind.projection(any(Bson.class))).thenReturn(headerFind);
        when(headerFind.sort(any(Bson.class))).thenReturn(headerFind);
        when(versionFind.projection(any(Bson.class))).thenReturn(versionFind);
        when(headers.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
        store = new MongoDocumentStore(database, counterStore, namespaceStore);
    }

    @Test
    void store_markdown_in_a_version_document_and_preserve_crlf() throws Exception {
        when(counterStore.getNextDocumentSequenceValue()).thenReturn(7);

        assertThat(store.createDocumentForNamespace(request, "finos", "knowledge").getVersion(), is("1.0.0"));

        verify(headers).insertOne(any(Document.class));
        verify(versions).insertOne(any(Document.class));
    }

    @Test
    void list_and_read_only_the_requested_document_type() throws Exception {
        Document header = new Document("documentId", 7).append("name", "name").append("versionCount", 1);
        Document version = new Document("content", new Document("documentMarkdown", request.getDocumentMarkdown()));
        when(headerFind.first()).thenReturn(header);
        when(versionFind.first()).thenReturn(version);
        doAnswer(invocation -> {
                    Consumer<Document> consumer = invocation.getArgument(0);
                    consumer.accept(header);
                    return null;
                })
                .when(headerFind)
                .forEach(any());
        doAnswer(invocation -> {
                    Consumer<Document> consumer = invocation.getArgument(0);
                    consumer.accept(new Document("version", "1.0.0"));
                    return null;
                })
                .when(versionFind)
                .forEach(any());

        assertThat(store.getDocumentsForNamespace("finos", "knowledge"), contains(7));
        assertThat(store.getDocumentVersions("finos", "knowledge", 7), contains("1.0.0"));
        assertThat(store.getDocumentForVersion("finos", "knowledge", 7, "1.0.0"), is(request.getDocumentMarkdown()));

        Bson namespaceFilter = Filters.and(Filters.eq("namespace", "finos"), Filters.eq("documentType", "knowledge"));
        Bson headerFilter = Filters.and(Filters.eq("namespace", "finos"), Filters.eq("documentId", 7),
                Filters.eq("documentType", "knowledge"));
        Bson versionFilter = Filters.and(Filters.eq("namespace", "finos"), Filters.eq("documentId", 7),
                Filters.eq("version", "1.0.0"), Filters.eq("documentType", "knowledge"));
        ArgumentCaptor<Bson> headerQueries = ArgumentCaptor.forClass(Bson.class);
        ArgumentCaptor<Bson> versionQueries = ArgumentCaptor.forClass(Bson.class);
        verify(headers, times(3)).find(headerQueries.capture());
        verify(versions, times(2)).find(versionQueries.capture());
        assertThat(headerQueries.getAllValues().stream().map(TestMongoDocumentStoreShould::bson).toList(),
                contains(bson(namespaceFilter), bson(headerFilter), bson(headerFilter)));
        assertThat(versionQueries.getAllValues().stream().map(TestMongoDocumentStoreShould::bson).toList(),
                contains(bson(headerFilter), bson(versionFilter)));
    }

    private static BsonDocument bson(Bson value) {
        return value.toBsonDocument(Document.class, com.mongodb.MongoClientSettings.getDefaultCodecRegistry());
    }

    @Test
    void report_missing_headers_and_versions() {
        when(headerFind.first()).thenReturn(null);
        assertThrows(DocumentNotFoundException.class, () -> store.getDocumentVersions("finos", "knowledge", 7));

        when(headerFind.first()).thenReturn(new Document("documentId", 7));
        when(versionFind.first()).thenReturn(null);
        assertThrows(
                DocumentVersionNotFoundException.class,
                () -> store.getDocumentForVersion("finos", "knowledge", 7, "1.0.0"));
    }

    @Test
    void create_a_version_and_update_the_document_details() throws Exception {
        when(headerFind.first()).thenReturn(new Document("documentId", 7));

        assertThat(store.createDocumentForVersion(request, "finos", "knowledge", 7, "2.0.0").getVersion(), is("2.0.0"));

        verify(versions).insertOne(argThat(version ->
                "knowledge".equals(version.getString("documentType"))
                        && "2.0.0".equals(version.getString("version"))
                        && request.getDocumentMarkdown().equals(version.get("content", Document.class).getString("documentMarkdown"))));
        verify(headers).updateOne(any(Bson.class), argThat((Bson update) ->
                update.toBsonDocument(Document.class, com.mongodb.MongoClientSettings.getDefaultCodecRegistry()).equals(
                        new Document("$set", new Document("name", request.getName()).append("description", request.getDescription()))
                                .toBsonDocument(Document.class, com.mongodb.MongoClientSettings.getDefaultCodecRegistry()))));
    }

    @Test
    void reject_a_duplicate_version_without_renaming_the_document() {
        when(headerFind.first()).thenReturn(new Document("documentId", 7));
        doThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()),
                new ServerAddress(), List.of())).when(versions).insertOne(any(Document.class));

        assertThrows(DocumentVersionExistsException.class,
                () -> store.createDocumentForVersion(request, "finos", "knowledge", 7, "1.0.0"));

        verify(headers, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void reject_a_missing_namespace_before_writing() {
        assertThrows(NamespaceNotFoundException.class,
                () -> store.createDocumentForNamespace(request, "missing", "knowledge"));

        verify(headers, never()).insertOne(any(Document.class));
        verify(versions, never()).insertOne(any(Document.class));
    }
}
