package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.standards.NamespaceStandardSummary;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteStandardStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteStandardStore standardStore;

    private final String NAMESPACE = "finos";
    private final String STANDARD_JSON = "{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\"}}}";
    // Default version used in tests
    private final int STANDARD_ID = 42;

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        standardStore = new NitriteStandardStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    @Test
    public void testGetStandardsForNamespace_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> standardStore.getStandardsForNamespace(NAMESPACE));
    }

    @Test
    public void testGetStandardsForNamespace_whenNoStandards_returnsEmptyList() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock cursor to return null for firstOrNull() (no namespace document found)
        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act
        List<NamespaceStandardSummary> result = standardStore.getStandardsForNamespace(NAMESPACE);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    public void testGetStandardsForNamespace_whenNamespaceExistsButStandardsArrayIsNull_returnsEmptyList() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Create namespace document with null standards array
        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("standards", null);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        List<NamespaceStandardSummary> result = standardStore.getStandardsForNamespace(NAMESPACE);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    public void testGetStandardsForNamespace_whenNamespaceExistsButStandardsArrayIsEmpty_returnsEmptyList() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Create namespace document with empty standards array
        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("standards", Collections.emptyList());

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        List<NamespaceStandardSummary> result = standardStore.getStandardsForNamespace(NAMESPACE);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    public void testGetStandardsForNamespace_whenStandardsExist_returnsStandards() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Map<String, Object> fullStandard = new HashMap<>();
        fullStandard.put("standardId", 2);
        fullStandard.put("name", "Test Name");
        fullStandard.put("description", "Test Description");

        Document standardDoc1 = Document.createDocument("standardId", 1);
        Document standardDoc2 = Document.createDocument(fullStandard);
        List<Document> standards = Arrays.asList(standardDoc1, standardDoc2);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("standards", standards);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        List<NamespaceStandardSummary> result = standardStore.getStandardsForNamespace(NAMESPACE);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.size(), is(2));
        assertThat(result.getFirst().getId(), is(1));
        assertThat(result.get(1).getId(), is(2));
        assertThat(result.get(1).getDescription(), is("Test Description"));
        assertThat(result.get(1).getName(), is("Test Name"));
    }

    @Test
    public void testCreateStandardForNamespace_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        // Arrange
        CreateStandardRequest standard = new CreateStandardRequest();
        standard.setStandardJson(STANDARD_JSON);

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> standardStore.createStandardForNamespace(standard, NAMESPACE));
    }

    @Test
    public void testCreateStandardForNamespace_whenNamespaceExists_createsStandard() throws NamespaceNotFoundException {
        // Arrange
        CreateStandardRequest standard = new CreateStandardRequest();
        standard.setStandardJson(STANDARD_JSON);

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCounterStore.getNextStandardSequenceValue()).thenReturn(STANDARD_ID);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Standard result = standardStore.createStandardForNamespace(standard, NAMESPACE);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.getId(), is(STANDARD_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getStandardJson(), is(STANDARD_JSON));
        assertThat(result.getVersion(), is("1.0.0"));

        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void testGetStandardVersions_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> standardStore.getStandardVersions(NAMESPACE, STANDARD_ID));
    }

    @Test
    public void testGetStandardVersions_whenStandardDoesNotExist_throwsStandardNotFoundException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mock(DocumentCursor.class));

        // Act & Assert
        assertThrows(StandardNotFoundException.class, () -> standardStore.getStandardVersions(NAMESPACE, STANDARD_ID));
    }

    @Test
    public void testGetStandardVersions_whenVersionsExist_returnsVersionsList() throws NamespaceNotFoundException, StandardNotFoundException {
        // Arrange

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.getFields()).thenReturn(new HashSet<>(Arrays.asList("1-0-0", "1-1-0")));

        // Mock the standard document
        Document standardDoc = mock(Document.class);
        when(standardDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(standardDoc.get("standardId", Integer.class)).thenReturn(STANDARD_ID);

        // Create the namespace document with the standard
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("standards"), any())).thenReturn(Collections.singletonList(standardDoc));

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Set up the namespace store mock
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Act
        List<String> result = standardStore.getStandardVersions(NAMESPACE, STANDARD_ID);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.size(), is(2));
        assertThat(result, hasItem("1-0-0"));
        assertThat(result, hasItem("1-1-0"));
    }

    @Test
    public void testGetStandardForVersion_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> standardStore.getStandardForVersion(NAMESPACE, STANDARD_ID, "1.0.0"));
    }

    @Test
    public void testGetStandardForVersion_whenStandardDoesNotExist_throwsStandardNotFoundException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Create a mock cursor that returns null for firstOrNull()
        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act & Assert
        assertThrows(StandardNotFoundException.class, () -> standardStore.getStandardForVersion(NAMESPACE, STANDARD_ID, "1.0.0"));
    }

    @Test
    public void testGetStandardForVersion_whenVersionDoesNotExist_throwsStandardVersionNotFoundException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.get("2-0-0", Document.class)).thenReturn(null); // Version not found

        // Mock the standard document
        Document standardDoc = mock(Document.class);
        when(standardDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(standardDoc.get("standardId", Integer.class)).thenReturn(STANDARD_ID);

        // Create the namespace document with the standard
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("standards"), any())).thenReturn(Collections.singletonList(standardDoc));

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act & Assert
        assertThrows(StandardVersionNotFoundException.class, () -> standardStore.getStandardForVersion(NAMESPACE, STANDARD_ID, "2.0.0"));
    }

    @Test
    public void testGetStandardForVersion_whenVersionExists_returnsStandard() throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Standard expectedStandard = new Standard();
        expectedStandard.setId(STANDARD_ID);
        expectedStandard.setName("Test Standard");
        expectedStandard.setDescription("Test Description");
        expectedStandard.setNamespace(NAMESPACE);
        expectedStandard.setId(STANDARD_ID);
        expectedStandard.setVersion("2.0.0");
        expectedStandard.setStandardJson("{}");

        Document versionDoc = mock(Document.class);
        when(versionDoc.get(eq("standardJson"), any())).thenReturn(expectedStandard.getStandardJson());

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.get(eq("2-0-0"), any())).thenReturn(versionDoc);

        // Mock the standard document
        Document standardDoc = mock(Document.class);
        when(standardDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(standardDoc.get("standardId", Integer.class)).thenReturn(STANDARD_ID);

        // Create the namespace document with the standard
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("standards"), any())).thenReturn(Collections.singletonList(standardDoc));

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        String standard = standardStore.getStandardForVersion(NAMESPACE, STANDARD_ID, expectedStandard.getVersion());

        // Assert
        assertThat(standard, equalTo("{}"));
    }

    @Test
    public void testCreateStandardForVersion_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        // Arrange
        CreateStandardRequest standard = getStandardToPersist();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> standardStore.createStandardForVersion(standard, NAMESPACE, null, null));
    }

    private CreateStandardRequest getStandardToPersist() {
        return new CreateStandardRequest("Test", "Test Description", STANDARD_JSON);
    }

    @Test
    public void testCreateStandardForVersion_whenNamespaceDocumentDoesNotExist_throwsStandardNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Create a mock cursor that returns null for firstOrNull()
        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act & Assert
        assertThrows(StandardNotFoundException.class, () -> standardStore.createStandardForVersion(getStandardToPersist(), NAMESPACE, null, null));
    }

    @Test
    public void testCreateStandardForVersion_whenStandardDoesNotExist_throwsStandardNotFoundException() {
        // Arrange
        CreateStandardRequest standard = getStandardToPersist();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the namespace document
        Document namespaceDoc = mock(Document.class);

        // Set up the cursor mock for namespace document
        DocumentCursor namespaceCursor = mock(DocumentCursor.class);
        when(namespaceCursor.firstOrNull()).thenReturn(namespaceDoc);

        // Set up the cursor mock for pattern document (not found)
        DocumentCursor standardCursor = mock(DocumentCursor.class);
        when(standardCursor.firstOrNull()).thenReturn(null);

        // Set up the collection mock to return different cursors based on the filter
        when(mockCollection.find(any(Filter.class))).thenReturn(namespaceCursor, standardCursor);

        // Act & Assert
        assertThrows(StandardNotFoundException.class, () -> standardStore.createStandardForVersion(standard, NAMESPACE, STANDARD_ID, null));
    }

    @Test
    public void testCreateStandardForVersion_whenVersionAlreadyExists_throwsStandardVersionExistsException() {
        // Arrange
        CreateStandardRequest standard = getStandardToPersist();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.containsKey(anyString())).thenReturn(true); // Version already exists

        // Mock the standard document
        Document standardDoc = mock(Document.class);
        when(standardDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(standardDoc.get("standardId", Integer.class)).thenReturn(STANDARD_ID);

        // Create a list of standards with document
        List<Document> standards = Collections.singletonList(standardDoc);

        // Mock the namespace document
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("standards"), any())).thenReturn(standards);

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act & Assert
        assertThrows(StandardVersionExistsException.class, () -> standardStore.createStandardForVersion(standard, NAMESPACE, STANDARD_ID, "1.0.0"));
    }

    @Test
    public void testCreateStandardForVersion_whenSuccess_returnsStandard() throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        // Arrange
        CreateStandardRequest createStandardRequest = getStandardToPersist();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.containsKey(anyString())).thenReturn(false); // Version doesn't exist yet

        // Mock the standard document
        Document standardDoc = mock(Document.class);
        when(standardDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(standardDoc.get("standardId", Integer.class)).thenReturn(STANDARD_ID);

        // Create a list of standards with our standards document
        List<Document> standards = new ArrayList<>();
        standards.add(standardDoc);

        // Mock the namespace document
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("standards"), any())).thenReturn(standards);

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Standard result = standardStore.createStandardForVersion(createStandardRequest, NAMESPACE, STANDARD_ID, "1.0.0");

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.getId(), is(STANDARD_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getVersion(), is("1.0.0"));
    }
}
