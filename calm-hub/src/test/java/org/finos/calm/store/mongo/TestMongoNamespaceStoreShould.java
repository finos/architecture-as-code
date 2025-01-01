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
    MongoClient mongoClient;

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> namespaceCollection;

    private MongoNamespaceStore mongoNamespaceStore;

    @BeforeEach
    void setup() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
        namespaceCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("namespaces")).thenReturn(namespaceCollection);
        mongoNamespaceStore = new MongoNamespaceStore(mongoClient);
    }

    @Test
    void return_an_empty_list_when_no_namespaces_exist() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        MongoCursor<Document> emptyCursor = Mockito.mock(MongoCursor.class);

        when(emptyCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(emptyCursor);
        when(namespaceCollection.find()).thenReturn(findIterable);

        List<String> namespaces = mongoNamespaceStore.getNamespaces();
        assertThat(namespaces, is(empty()));
        verify(namespaceCollection).find();
    }

    @Test
    void return_list_of_namespaces() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        MongoCursor<Document> cursor = Mockito.mock(MongoCursor.class);

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
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        String namespace = "does-note-exist";

        when(namespaceCollection.find(any(Document.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoNamespaceStore.namespaceExists(namespace), is(false));
        verify(namespaceCollection).find(new Document("namespace", namespace));
    }

    @Test
    void return_true_when_namespace_exists() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        String namespace = "finos";

        when(namespaceCollection.find(any(Document.class))).thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        assertThat(mongoNamespaceStore.namespaceExists(namespace), is(true));
        verify(namespaceCollection).find(new Document("namespace", namespace));
    }
}
