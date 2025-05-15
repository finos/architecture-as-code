package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteDomainStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    private NitriteDomainStore domainStore;

    private static final String TEST_DOMAIN_NAME = "testDomain";

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        domainStore = new NitriteDomainStore(mockDb);
    }

    @Test
    public void testGetDomains_returnsEmptyList_whenNoDomainsExist() {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(new ArrayList<Document>().iterator());
        when(mockCollection.find()).thenReturn(cursor);

        // Act
        List<String> result = domainStore.getDomains();

        // Assert
        assertTrue(result.isEmpty());
        verify(mockCollection).find();
    }

    @Test
    public void testGetDomains_returnsDomainNames_whenDomainsExist() {
        // Arrange
        Document domain1 = Document.createDocument().put("name", "domain1");
        Document domain2 = Document.createDocument().put("name", "domain2");
        List<Document> domains = Arrays.asList(domain1, domain2);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.iterator()).thenReturn(domains.iterator());
        when(mockCollection.find()).thenReturn(cursor);

        // Act
        List<String> result = domainStore.getDomains();

        // Assert
        assertEquals(2, result.size());
        assertTrue(result.contains("domain1"));
        assertTrue(result.contains("domain2"));
        verify(mockCollection).find();
    }

    @Test
    public void testCreateDomain_throwsException_whenDomainAlreadyExists() {
        // Arrange
        Document existingDomain = Document.createDocument().put("name", TEST_DOMAIN_NAME);
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(existingDomain);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act & Assert
        assertThrows(DomainAlreadyExistsException.class, () -> domainStore.createDomain(TEST_DOMAIN_NAME));
        verify(mockCollection).find(any(Filter.class));
        verify(mockCollection, never()).insert(any(Document.class));
    }

    @Test
    public void testCreateDomain_createsDomain_whenDomainDoesNotExist() throws DomainAlreadyExistsException {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Domain result = domainStore.createDomain(TEST_DOMAIN_NAME);

        // Assert
        assertNotNull(result);
        assertEquals(TEST_DOMAIN_NAME, result.getName());
        verify(mockCollection).find(any(Filter.class));
        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void testCreateDomain_insertsCorrectDocument() throws DomainAlreadyExistsException {
        // Arrange
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        domainStore.createDomain(TEST_DOMAIN_NAME);

        // Assert
        verify(mockCollection).insert(any(Document.class));
    }
}
