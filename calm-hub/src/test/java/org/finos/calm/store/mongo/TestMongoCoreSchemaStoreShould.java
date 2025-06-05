package org.finos.calm.store.mongo;

import com.mongodb.client.*;
import com.mongodb.client.model.Filters;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
public class TestMongoCoreSchemaStoreShould {

    @InjectMock
    MongoClient mongoClient;

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> schemaCollection;

    private MongoCoreSchemaStore mongoCoreSchemaStore;

    @BeforeEach
    public void setup() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
        schemaCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("schemas")).thenReturn(schemaCollection);
        mongoCoreSchemaStore = new MongoCoreSchemaStore(mongoClient);
    }

    @Test
    void get_versions_returns_an_empty_array_when_schema_collection_is_empty() {
        FindIterable<Document> findIterable = emptyFindIterableSetup();
        when(schemaCollection.find()).thenReturn(findIterable);

        List<String> versions = mongoCoreSchemaStore.getVersions();

        assertThat(versions, is(empty()));
        verify(schemaCollection).find();
    }

    @Test
    void get_versions_returns_items_in_collection() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        MongoCursor<Document> cursor = Mockito.mock(MongoCursor.class);

        Document doc1 = new Document("version", "1.0.0");
        Document doc2 = new Document("version", "1.0.1");

        // Set up the mock cursor to return documents with version data
        when(cursor.hasNext()).thenReturn(true, true, false); // 3 documents, then end
        when(cursor.next()).thenReturn(doc1, doc2);
        when(findIterable.iterator()).thenReturn(cursor);
        when(schemaCollection.find()).thenReturn(findIterable);

        // Call the method under test
        List<String> versions = mongoCoreSchemaStore.getVersions();

        // Verify that the result is the expected list of versions
        List<String> expectedVersions = Arrays.asList("1.0.0", "1.0.1");
        assertThat(versions, is(expectedVersions));
    }

    @Test
    void get_schemas_for_version_when_version_doesnt_exist() {
        FindIterable<Document> findIterable = emptyFindIterableSetup();
        when(schemaCollection.find(any(Bson.class))).thenReturn(findIterable);

        String version = "1.0.0";
        assertThat(mongoCoreSchemaStore.getSchemasForVersion(version), is(nullValue()));
        verify(schemaCollection).find(Filters.eq("version", version));
        verify(findIterable).first();
    }

    @Test
    void get_schemas_for_version() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(schemaCollection.find(any(Bson.class))).thenReturn(findIterable);

        Map<String, Object> schemas = new HashMap<>();
        Document documentMock = Mockito.mock(Document.class);
        when(documentMock.get(anyString())).thenReturn(schemas);

        when(schemaCollection.find()).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(documentMock);

        mongoCoreSchemaStore.getSchemasForVersion("1.0.0");
        verify(schemaCollection).find(Filters.eq("version", "1.0.0"));
        verify(documentMock).get("schemas", Map.class);
    }

    @Test
    void create_schema_version_when_version_does_not_exist() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(schemaCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null); // version doesn't exist

        Map<String, Object> schemas = new HashMap<>();
        schemas.put("calm.json", new HashMap<>());
        schemas.put("core.json", new HashMap<>());

        mongoCoreSchemaStore.createSchemaVersion("2024-10", schemas);

        verify(schemaCollection).find(Filters.eq("version", "2024-10"));
        verify(schemaCollection).insertOne(any(Document.class));
    }

    @Test
    void do_not_create_schema_version_when_version_already_exists() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(schemaCollection.find(any(Bson.class))).thenReturn(findIterable);
        
        Document existingDoc = new Document("version", "2024-10");
        when(findIterable.first()).thenReturn(existingDoc); // version exists

        Map<String, Object> schemas = new HashMap<>();
        schemas.put("calm.json", new HashMap<>());

        mongoCoreSchemaStore.createSchemaVersion("2024-10", schemas);

        verify(schemaCollection).find(Filters.eq("version", "2024-10"));
        verify(schemaCollection, Mockito.never()).insertOne(any(Document.class));
    }

    private FindIterable<Document> emptyFindIterableSetup() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        MongoCursor<Document> emptyCursor = Mockito.mock(MongoCursor.class);

        when(emptyCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(emptyCursor);
        return findIterable;
    }
}
