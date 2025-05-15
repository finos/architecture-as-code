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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteNamespaceStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    private NitriteNamespaceStore namespaceStore;

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        namespaceStore = new NitriteNamespaceStore(mockDb);
    }

    @Test
    public void testGetNamespaces_whenNamespacesExist_returnsNamespacesList() {
        // Arrange
        Document doc1 = Document.createDocument("namespace", "finos");
        Document doc2 = Document.createDocument("namespace", "workshop");
        List<Document> documents = Arrays.asList(doc1, doc2);
        
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(documents.iterator());
        when(mockCollection.find()).thenReturn(cursor);
        
        // Act
        List<String> result = namespaceStore.getNamespaces();
        
        // Assert
        assertEquals(2, result.size());
        assertTrue(result.contains("finos"));
        assertTrue(result.contains("workshop"));
    }
    
    @Test
    public void testGetNamespaces_whenNoNamespacesExist_returnsEmptyList() {
        // Arrange
        List<Document> emptyList = new ArrayList<>();
        
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(emptyList.iterator());
        when(mockCollection.find()).thenReturn(cursor);
        
        // Act
        List<String> result = namespaceStore.getNamespaces();
        
        // Assert
        assertTrue(result.isEmpty());
    }
    
    @Test
    public void testNamespaceExists_whenNamespaceExists_returnsTrue() {
        // Arrange
        Document doc = Document.createDocument("namespace", "finos");
        
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(doc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);
        
        // Act
        boolean result = namespaceStore.namespaceExists("finos");
        
        // Assert
        assertTrue(result);
    }
    
    @Test
    public void testNamespaceExists_whenNamespaceDoesNotExist_returnsFalse() {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);
        
        // Act
        boolean result = namespaceStore.namespaceExists("non-existent");
        
        // Assert
        assertFalse(result);
    }
}
