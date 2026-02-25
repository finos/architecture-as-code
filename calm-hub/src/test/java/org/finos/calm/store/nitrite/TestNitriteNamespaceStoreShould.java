package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
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
        Document doc1 = Document.createDocument("name", "finos").put("description","d1");
        Document doc2 = Document.createDocument("name", "workshop").put("description","d2");
        List<Document> documents = Arrays.asList(doc1, doc2);
        
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(documents.iterator());
        when(mockCollection.find()).thenReturn(cursor);
        
        // Act
        List<NamespaceInfo> result = namespaceStore.getNamespaces();
        
        // Assert
        assertThat(result, hasSize(2));
        assertThat(result.get(0).getName(), is("finos"));
        assertThat(result.get(1).getName(), is("workshop"));
        assertThat(result.get(0).getDescription(), is("d1"));
        assertThat(result.get(1).getDescription(), is("d2"));
    }
    
    @Test
    public void testGetNamespaces_whenNoNamespacesExist_returnsEmptyList() {
        // Arrange
        List<Document> emptyList = new ArrayList<>();
        
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(emptyList.iterator());
        when(mockCollection.find()).thenReturn(cursor);
        
        // Act
        List<NamespaceInfo> result = namespaceStore.getNamespaces();
        
        // Assert
        assertThat(result, is(empty()));
    }
    
    @Test
    public void testNamespaceExists_whenNamespaceExists_returnsTrue() {
        // Arrange
        Document doc = Document.createDocument("name", "finos");
        
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(doc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);
        
        // Act
        boolean result = namespaceStore.namespaceExists("finos");
        
        // Assert
        assertThat(result, is(true));
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
        assertThat(result, is(false));
    }
    
    @Test
    public void testCreateNamespace_whenNamespaceDoesNotExist_createsNamespace() {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);
        
        // Act
        namespaceStore.createNamespace("new-namespace","desc");
        
        // Assert
        verify(mockCollection).insert(any(Document.class));
    }
    
    @Test
    public void testCreateNamespace_whenNamespaceAlreadyExists_doesNotCreateDuplicate() {
        // Arrange
        Document existingDoc = Document.createDocument("name", "existing-namespace");
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(existingDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);
        
        // Act
        namespaceStore.createNamespace("existing-namespace","desc");
        
        // Assert
        verify(mockCollection, never()).insert(any(Document.class));
    }
}
