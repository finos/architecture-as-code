package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteCoreSchemaStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    private NitriteCoreSchemaStore schemaStore;

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        schemaStore = new NitriteCoreSchemaStore(mockDb);
    }

    @Test
    public void testGetVersions_whenCollectionIsEmpty_returnsEmptyList() {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(new EmptyDocumentIterator());
        when(mockCollection.find()).thenReturn(cursor);

        // Act
        List<String> versions = schemaStore.getVersions();

        // Assert
        assertThat(versions.isEmpty(), is(true));
        verify(mockCollection).find();
    }

    @Test
    public void testGetVersions_whenCollectionHasDocuments_returnsVersions() {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);

        Document doc1 = Document.createDocument().put("version", "1.0.0");
        Document doc2 = Document.createDocument().put("version", "1.0.1");

        when(cursor.iterator()).thenReturn(Arrays.asList(doc1, doc2).iterator());
        when(mockCollection.find()).thenReturn(cursor);

        // Act
        List<String> versions = schemaStore.getVersions();

        // Assert
        assertThat(versions.size(), is(2));
        assertThat(versions, hasItem("1.0.0"));
        assertThat(versions, hasItem("1.0.1"));
        verify(mockCollection).find();
    }

    @Test
    public void testGetSchemasForVersion_whenVersionDoesNotExist_returnsNull() {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Map<String, Object> schemas = schemaStore.getSchemasForVersion("1.0.0");

        // Assert
        assertThat(schemas, is(nullValue()));
        verify(mockCollection).find(any(Filter.class));
    }

    @Test
    public void testGetSchemasForVersion_whenVersionExists_returnsSchemas() {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);

        Map<String, Object> expectedSchemas = new HashMap<>();
        expectedSchemas.put("schema1", "value1");
        expectedSchemas.put("schema2", "value2");

        Document doc = Document.createDocument()
                .put("version", "1.0.0")
                .put("schemas", expectedSchemas);

        when(cursor.firstOrNull()).thenReturn(doc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Map<String, Object> schemas = schemaStore.getSchemasForVersion("1.0.0");

        // Assert
        assertThat(schemas, is(notNullValue()));
        assertThat(schemas, is(expectedSchemas));
        verify(mockCollection).find(any(Filter.class));
    }

    @Test
    public void testCreateSchemaVersion_whenVersionDoesNotExist_createsNewVersion() {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Map<String, Object> schemas = new HashMap<>();
        schemas.put("calm.json", new HashMap<>());
        schemas.put("core.json", new HashMap<>());

        // Act
        schemaStore.createSchemaVersion("2024-10", schemas);

        // Assert
        verify(mockCollection).find(any(Filter.class));
        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void testCreateSchemaVersion_whenVersionAlreadyExists_doesNotCreateDuplicate() {
        // Arrange
        Document existingDoc = Document.createDocument()
                .put("version", "2024-10")
                .put("schemas", new HashMap<>());
        
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(existingDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Map<String, Object> schemas = new HashMap<>();
        schemas.put("calm.json", new HashMap<>());

        // Act
        schemaStore.createSchemaVersion("2024-10", schemas);

        // Assert
        verify(mockCollection).find(any(Filter.class));
        verify(mockCollection, never()).insert(any(Document.class));
    }

    /**
     * Helper class to simulate an empty iterator for DocumentCursor
     */
    private static class EmptyDocumentIterator implements java.util.Iterator<Document> {
        @Override
        public boolean hasNext() {
            return false;
        }

        @Override
        public Document next() {
            throw new java.util.NoSuchElementException();
        }
    }
}
