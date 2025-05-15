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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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
        assertTrue(versions.isEmpty());
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
        assertEquals(2, versions.size());
        assertTrue(versions.contains("1.0.0"));
        assertTrue(versions.contains("1.0.1"));
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
        assertNull(schemas);
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
        assertNotNull(schemas);
        assertEquals(expectedSchemas, schemas);
        verify(mockCollection).find(any(Filter.class));
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
