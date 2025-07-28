package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.standards.CreatePatternRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitritePatternStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitritePatternStore patternStore;

    private final String NAMESPACE = "finos";
    private final String PATTERN_JSON = "{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\"}}}";
    // Default version used in tests
    private final int PATTERN_ID = 42;

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        patternStore = new NitritePatternStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    @Test
    public void testGetPatternsForNamespace_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> patternStore.getPatternsForNamespace(NAMESPACE));
    }

    @Test
    public void testGetPatternsForNamespace_whenNoPatterns_returnsEmptyList() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Create a mock cursor that returns null for firstOrNull()
        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act
        List<Integer> result = patternStore.getPatternsForNamespace(NAMESPACE);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    public void testGetPatternsForNamespace_whenPatternsExist_returnsPatternIds() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document patternDoc1 = Document.createDocument("patternId", 1);
        Document patternDoc2 = Document.createDocument("patternId", 2);
        List<Document> patterns = Arrays.asList(patternDoc1, patternDoc2);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("patterns", patterns);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        List<Integer> result = patternStore.getPatternsForNamespace(NAMESPACE);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.size(), is(2));
        assertThat(result, hasItem(1));
        assertThat(result, hasItem(2));
    }

    @Test
    public void testCreatePatternForNamespace_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        // Arrange
        CreatePatternRequest pattern = new CreatePatternRequest();
        pattern.setPatternJson(PATTERN_JSON);

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> patternStore.createPatternForNamespace(pattern, NAMESPACE));
    }

    @Test
    public void testCreatePatternForNamespace_whenNamespaceExists_createsPattern() throws NamespaceNotFoundException {
        // Arrange
        CreatePatternRequest pattern = new CreatePatternRequest();
        pattern.setPatternJson(PATTERN_JSON);

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCounterStore.getNextPatternSequenceValue()).thenReturn(PATTERN_ID);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Pattern result = patternStore.createPatternForNamespace(pattern, NAMESPACE);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.getId(), is(PATTERN_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getPatternJson(), is(PATTERN_JSON));
        assertThat(result.getMongoVersion(), is("1-0-0"));

        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void testGetPatternVersions_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> patternStore.getPatternVersions(NAMESPACE, PATTERN_ID));
    }

    @Test
    public void testGetPatternVersions_whenPatternDoesNotExist_throwsPatternNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mock(DocumentCursor.class));

        // Act & Assert
        assertThrows(PatternNotFoundException.class, () -> patternStore.getPatternVersions(NAMESPACE, PATTERN_ID));
    }

    @Test
    public void testGetPatternVersions_whenVersionsExist_returnsVersionsList() throws NamespaceNotFoundException, PatternNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Create a simplified test setup that focuses only on what's needed
        // for the getPatternVersions method to work

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.getFields()).thenReturn(new HashSet<>(Arrays.asList("1-0-0", "1-1-0")));

        // Mock the pattern document
        Document patternDoc = mock(Document.class);
        when(patternDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(patternDoc.get("patternId", Integer.class)).thenReturn(PATTERN_ID);

        // Create the namespace document with the pattern
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("patterns"), any())).thenReturn(Collections.singletonList(patternDoc));

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Set up the namespace store mock
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Act
        List<String> result = patternStore.getPatternVersions(NAMESPACE, PATTERN_ID);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.size(), is(2));
        assertThat(result, hasItem("1-0-0"));
        assertThat(result, hasItem("1-1-0"));
    }

    @Test
    public void testGetPatternForVersion_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> patternStore.getPatternForVersion(NAMESPACE, PATTERN_ID, "1.0.0"));
    }

    @Test
    public void testGetPatternForVersion_whenPatternDoesNotExist_throwsPatternNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Create a mock cursor that returns null for firstOrNull()
        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act & Assert
        assertThrows(PatternNotFoundException.class, () -> patternStore.getPatternForVersion(NAMESPACE, PATTERN_ID, "1.0.0"));
    }

    @Test
    public void testGetPatternForVersion_whenVersionDoesNotExist_throwsPatternVersionNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.get("2-0-0", Document.class)).thenReturn(null); // Version not found

        // Mock the pattern document
        Document patternDoc = mock(Document.class);
        when(patternDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(patternDoc.get("patternId", Integer.class)).thenReturn(PATTERN_ID);

        // Create the namespace document with the pattern
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("patterns"), any())).thenReturn(Collections.singletonList(NAMESPACE, PATTERN_ID, "2.0.0"));

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act & Assert
        assertThrows(PatternVersionNotFoundException.class, () -> patternStore.getPatternForVersion(pattern));
    }

    @Test
    public void testGetPatternForVersion_whenVersionExists_returnsPattern() throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        // Arrange
        Pattern expectedPattern = new Pattern();
        expectedPattern.setId(PATTERN_ID);
        expectedPattern.setName("Test Pattern");
        expectedPattern.setDescription("Test Description");
        expectedPattern.setNamespace(NAMESPACE);
        expectedPattern.setVersion("2.0.0");
        expectedPattern.setPatternJson("{}");

        Document versionDoc = mock(Document.class);
        when(versionDoc.get(eq("patternJson"), any())).thenReturn(expectedPattern.getPatternJson());

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.get(eq("2-0-0"), any())).thenReturn(versionDoc);

        // Mock the pattern document
        Document patternDoc = mock(Document.class);
        when(patternDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(patternDoc.get("patternId", Integer.class)).thenReturn(PATTERN_ID);
        when(patternDoc.get("name", String.class)).thenReturn(expectedPattern.getName());
        when(patternDoc.get("description", String.class)).thenReturn(expectedPattern.getDescription());

        // Create the namespace document with the pattern
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("patterns"), any())).thenReturn(Collections.singletonList(patternDoc));

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        String result = patternStore.getPatternForVersion(pattern);
        Pattern pattern = patternStore.getPatternForVersion(NAMESPACE, STANDARD_ID, expectedPattern.getVersion());

        // Assert
        assertThat(pattern, equalTo(expectedPattern));
    }

    @Test
    public void testCreatePatternForVersion_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        // Arrange
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace(NAMESPACE)
                .setId(PATTERN_ID)
                .setVersion("1-0-0")
                .setPattern(PATTERN_JSON)
                .build();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> patternStore.createPatternForVersion(pattern));
    }

    @Test
    public void testCreatePatternForVersion_whenNamespaceDocumentDoesNotExist_throwsPatternNotFoundException() {
        // Arrange
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace(NAMESPACE)
                .setId(PATTERN_ID)
                .setVersion("1-0-0")
                .setPattern(PATTERN_JSON)
                .build();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Create a mock cursor that returns null for firstOrNull()
        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act & Assert
        assertThrows(PatternNotFoundException.class, () -> patternStore.createPatternForVersion(pattern));
    }

    @Test
    public void testCreatePatternForVersion_whenPatternDoesNotExist_throwsPatternNotFoundException() {
        // Arrange
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace(NAMESPACE)
                .setId(PATTERN_ID)
                .setVersion("1-0-0")
                .setPattern(PATTERN_JSON)
                .build();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the namespace document
        Document namespaceDoc = mock(Document.class);

        // Set up the cursor mock for namespace document
        DocumentCursor namespaceCursor = mock(DocumentCursor.class);
        when(namespaceCursor.firstOrNull()).thenReturn(namespaceDoc);

        // Set up the cursor mock for pattern document (not found)
        DocumentCursor patternCursor = mock(DocumentCursor.class);
        when(patternCursor.firstOrNull()).thenReturn(null);

        // Set up the collection mock to return different cursors based on the filter
        when(mockCollection.find(any(Filter.class))).thenReturn(namespaceCursor, patternCursor);

        // Act & Assert
        assertThrows(PatternNotFoundException.class, () -> patternStore.createPatternForVersion(pattern));
    }

    @Test
    public void testCreatePatternForVersion_whenVersionAlreadyExists_throwsPatternVersionExistsException() {
        // Arrange
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace(NAMESPACE)
                .setId(PATTERN_ID)
                .setVersion("1-0-0")
                .setPattern(PATTERN_JSON)
                .build();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.containsKey(anyString())).thenReturn(true); // Version already exists

        // Mock the pattern document
        Document patternDoc = mock(Document.class);
        when(patternDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(patternDoc.get("patternId", Integer.class)).thenReturn(PATTERN_ID);

        // Create a list of patterns with our pattern document
        List<Document> patterns = Collections.singletonList(patternDoc);

        // Mock the namespace document
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("patterns"), any())).thenReturn(patterns);

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act & Assert
        assertThrows(PatternVersionExistsException.class, () -> patternStore.createPatternForVersion(pattern));
    }

    @Test
    public void testCreatePatternForVersion_whenSuccess_returnsPattern() throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException {
        // Arrange
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace(NAMESPACE)
                .setId(PATTERN_ID)
                .setVersion("1-0-0")
                .setPattern(PATTERN_JSON)
                .build();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);
        when(versionsDoc.containsKey(anyString())).thenReturn(false); // Version doesn't exist yet

        // Mock the pattern document
        Document patternDoc = mock(Document.class);
        when(patternDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(patternDoc.get("patternId", Integer.class)).thenReturn(PATTERN_ID);

        // Create a list of patterns with our pattern document
        List<Document> patterns = new ArrayList<>();
        patterns.add(patternDoc);

        // Mock the namespace document
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("patterns"), any())).thenReturn(patterns);

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Pattern result = patternStore.createPatternForVersion(pattern);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.getId(), is(PATTERN_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getMongoVersion(), is("1-0-0"));
    }

    @Test
    public void testUpdatePatternForVersion_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        // Arrange
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace(NAMESPACE)
                .setId(PATTERN_ID)
                .setVersion("1-0-0")
                .setPattern(PATTERN_JSON)
                .build();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> patternStore.updatePatternForVersion(pattern));
    }

    @Test
    public void testUpdatePatternForVersion_whenPatternDoesNotExist_throwsPatternNotFoundException() {
        // Arrange
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace(NAMESPACE)
                .setId(PATTERN_ID)
                .setVersion("1-0-0")
                .setPattern(PATTERN_JSON)
                .build();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Create a mock cursor that returns null for firstOrNull()
        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act & Assert
        assertThrows(PatternNotFoundException.class, () -> patternStore.updatePatternForVersion(pattern));
    }

    @Test
    public void testUpdatePatternForVersion_createsNewVersionIfNotExists() throws NamespaceNotFoundException, PatternNotFoundException {
        // Arrange
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace(NAMESPACE)
                .setId(PATTERN_ID)
                .setVersion("2-0-0") // Version that doesn't exist yet
                .setPattern(PATTERN_JSON)
                .build();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);

        // Mock the pattern document
        Document patternDoc = mock(Document.class);
        when(patternDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(patternDoc.get("patternId", Integer.class)).thenReturn(PATTERN_ID);

        // Create a list of patterns with our pattern document - must be mutable
        List<Document> patterns = new ArrayList<>();
        patterns.add(patternDoc);

        // Mock the namespace document
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("patterns"), any())).thenReturn(patterns);

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Pattern result = patternStore.updatePatternForVersion(pattern);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.getId(), is(PATTERN_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getMongoVersion(), is("2-0-0"));
        assertThat(result.getPatternJson(), is(PATTERN_JSON));

        // Verify that the version was added
        verify(versionsDoc).put(eq("2-0-0"), eq(PATTERN_JSON));
    }

    @Test
    public void testUpdatePatternForVersion_whenSuccess_returnsPattern() throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException {
        // Arrange
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace(NAMESPACE)
                .setId(PATTERN_ID)
                .setVersion("1-0-0")
                .setPattern(PATTERN_JSON)
                .build();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        // Mock the versionsDoc with the fields we need
        Document versionsDoc = mock(Document.class);

        // Mock the pattern document
        Document patternDoc = mock(Document.class);
        when(patternDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(patternDoc.get("patternId", Integer.class)).thenReturn(PATTERN_ID);

        // Create a list of patterns with our pattern document
        List<Document> patterns = new ArrayList<>();
        patterns.add(patternDoc);

        // Mock the namespace document
        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("patterns"), any())).thenReturn(patterns);

        // Set up the cursor mock
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Pattern result = patternStore.updatePatternForVersion(pattern);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.getId(), is(PATTERN_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getMongoVersion(), is("1-0-0"));
        assertThat(result.getPatternJson(), is(PATTERN_JSON));
    }
}
