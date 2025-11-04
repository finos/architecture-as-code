package org.finos.calm.store.mongo;

import com.mongodb.client.*;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Arrays;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
public class TestMongoNamespaceStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    private MongoCollection<Document> namespaceCollection;

    private MongoNamespaceStore mongoNamespaceStore;

    @BeforeEach
    void setup() {
        namespaceCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("namespaces")).thenReturn(namespaceCollection);
        mongoNamespaceStore = new MongoNamespaceStore(mongoDatabase);
    }

    @Test
    void return_an_empty_list_when_no_namespaces_exist() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor emptyCursor = Mockito.mock(DocumentMongoCursor.class);

        when(emptyCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(emptyCursor);
        when(namespaceCollection.find()).thenReturn(findIterable);

        List<String> namespaces = mongoNamespaceStore.getNamespaces();
        assertThat(namespaces, is(empty()));
        verify(namespaceCollection).find();
    }

    @Test
    void return_list_of_namespaces() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = Mockito.mock(DocumentMongoCursor.class);

        Document doc1 = new Document("namespace", "finos");
        Document doc2 = new Document("namespace", "other");

        when(cursor.hasNext()).thenReturn(true, true, false); // 3 documents, then end
        when(cursor.next()).thenReturn(doc1, doc2);
        when(findIterable.iterator()).thenReturn(cursor);
        when(namespaceCollection.find()).thenReturn(findIterable);

        List<String> namespaces = mongoNamespaceStore.getNamespaces();
        List<String> expectedNamespaces = Arrays.asList("finos", "other");

        assertThat(namespaces, is(expectedNamespaces));
    }

    @Test
    void return_false_when_namespace_does_not_exist() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        String namespace = "does-note-exist";

        when(namespaceCollection.find(any(Document.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoNamespaceStore.namespaceExists(namespace), is(false));
        verify(namespaceCollection).find(new Document("namespace", namespace));
    }

    @Test
    void return_true_when_namespace_exists() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        String namespace = "finos";

        when(namespaceCollection.find(any(Document.class))).thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        assertThat(mongoNamespaceStore.namespaceExists(namespace), is(true));
        verify(namespaceCollection).find(new Document("namespace", namespace));
    }

    @Test
    void create_namespace_when_it_does_not_exist() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        String namespace = "new-namespace";

        when(namespaceCollection.find(any(Document.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null); // namespace doesn't exist

        mongoNamespaceStore.createNamespace(namespace);

        verify(namespaceCollection).find(new Document("namespace", namespace));
        verify(namespaceCollection).insertOne(new Document("namespace", namespace));
    }

    @Test
    void do_not_create_namespace_when_it_already_exists() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        String namespace = "existing-namespace";

        when(namespaceCollection.find(any(Document.class))).thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock); // namespace exists

        mongoNamespaceStore.createNamespace(namespace);

        verify(namespaceCollection).find(new Document("namespace", namespace));
        verify(namespaceCollection, Mockito.never()).insertOne(any(Document.class));
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentMongoCursor extends MongoCursor<Document> {
    }
}
