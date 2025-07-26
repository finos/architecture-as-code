package org.finos.calm.store.nitrite;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
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
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteArchitectureStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteArchitectureStore architectureStore;

    private static final String NAMESPACE = "finos";
    private static final int ARCHITECTURE_ID = 42;
    private static final String VERSION = "1.0.0";
    private static final String VALID_JSON = "{\"test\": \"test\"}";
    private static final String ARCHITECTURE_NAME = "architecture-name";
    private static final String ARCHITECTURE_DESCRIPTION = "architecture description";

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        architectureStore = new NitriteArchitectureStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    @Test
    public void testGetArchitecturesForNamespace_whenNamespaceDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> architectureStore.getArchitecturesForNamespace(NAMESPACE));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitecturesForNamespace_whenNamespaceExistsButNoArchitectures_returnsEmptyList() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        List<Integer> result = architectureStore.getArchitecturesForNamespace(NAMESPACE);

        // Assert
        assertThat(result.isEmpty(), is(true));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitecturesForNamespace_whenNamespaceExistsButEmptyArchitectures_returnsEmptyList() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", new ArrayList<>());

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        List<Integer> result = architectureStore.getArchitecturesForNamespace(NAMESPACE);

        // Assert
        assertThat(result.isEmpty(), is(true));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitecturesForNamespace_whenNamespaceExistsButNoArchitecturesField_returnsEmptyList() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        List<Integer> result = architectureStore.getArchitecturesForNamespace(NAMESPACE);

        // Assert
        assertThat(result.isEmpty(), is(true));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitecturesForNamespace_whenArchitecturesExist_returnsArchitectureIds() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document doc1 = Document.createDocument().put("architectureId", 1001);
        Document doc2 = Document.createDocument().put("architectureId", 1002);
        List<Document> architectures = Arrays.asList(doc1, doc2);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", architectures);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        List<Integer> result = architectureStore.getArchitecturesForNamespace(NAMESPACE);

        // Assert
        assertThat(result.size(), is(2));
        assertThat(result, hasItem(1001));
        assertThat(result, hasItem(1002));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateArchitectureForNamespace_whenNamespaceDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .build();

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> architectureStore.createArchitectureForNamespace(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateArchitectureForNamespace_whenInvalidJson_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setArchitecture("Invalid JSON")
                .build();

        // Act & Assert
        assertThrows(Exception.class, () -> architectureStore.createArchitectureForNamespace(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateArchitectureForNamespace_whenValidParameters_returnsCreatedArchitecture() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCounterStore.getNextArchitectureSequenceValue()).thenReturn(ARCHITECTURE_ID);

        Architecture architectureToCreate = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setName(ARCHITECTURE_NAME)
                .setDescription(ARCHITECTURE_DESCRIPTION)
                .setArchitecture(VALID_JSON)
                .build();

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Architecture result = architectureStore.createArchitectureForNamespace(architectureToCreate);

        // Assert
        assertThat(result.getId(), is(ARCHITECTURE_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getDotVersion(), is("1.0.0"));
        assertThat(result.getName(), is(ARCHITECTURE_NAME));
        assertThat(result.getDescription(), is(ARCHITECTURE_DESCRIPTION));
        assertThat(result.getArchitectureJson(), is(VALID_JSON));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
        verify(mockCounterStore).getNextArchitectureSequenceValue();
        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void testCreateArchitectureForNamespace_whenNamespaceExistsWithArchitectures_updatesExistingDocument() throws NamespaceNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCounterStore.getNextArchitectureSequenceValue()).thenReturn(ARCHITECTURE_ID);

        Architecture architectureToCreate = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setArchitecture(VALID_JSON)
                .build();

        List<Document> existingArchitectures = new ArrayList<>();
        existingArchitectures.add(Document.createDocument().put("architectureId", 1001));

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", existingArchitectures);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        // Act
        Architecture result = architectureStore.createArchitectureForNamespace(architectureToCreate);

        // Assert
        assertThat(result.getId(), is(ARCHITECTURE_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getDotVersion(), is("1.0.0"));
        assertThat(result.getArchitectureJson(), is(VALID_JSON));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
        verify(mockCounterStore).getNextArchitectureSequenceValue();
        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void testGetArchitectureVersions_whenNamespaceDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .build();

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> architectureStore.getArchitectureVersions(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitectureVersions_whenArchitectureDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .build();

        // Act & Assert
        assertThrows(ArchitectureNotFoundException.class, () -> architectureStore.getArchitectureVersions(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitectureVersions_whenArchitectureExists_returnsVersions() throws NamespaceNotFoundException, ArchitectureNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("1-0-0", VALID_JSON)
                .put("1-1-0", VALID_JSON);

        Document architectureDoc = Document.createDocument()
                .put("architectureId", ARCHITECTURE_ID)
                .put("versions", versions);

        List<Document> architectures = new ArrayList<>();
        architectures.add(architectureDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", architectures);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .build();

        // Act
        List<String> result = architectureStore.getArchitectureVersions(architecture);

        // Assert
        assertThat(result.size(), is(2));
        assertThat(result, hasItem("1.0.0"));
        assertThat(result, hasItem("1.1.0"));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitectureForVersion_whenNamespaceDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION)
                .build();

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> architectureStore.getArchitectureForVersion(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitectureForVersion_whenArchitectureDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION)
                .build();

        // Act & Assert
        assertThrows(ArchitectureNotFoundException.class, () -> architectureStore.getArchitectureForVersion(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitectureForVersion_whenVersionDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("2-0-0", VALID_JSON);

        Document architectureDoc = Document.createDocument()
                .put("architectureId", ARCHITECTURE_ID)
                .put("versions", versions);

        List<Document> architectures = new ArrayList<>();
        architectures.add(architectureDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", architectures);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION)
                .build();

        // Act & Assert
        assertThrows(ArchitectureVersionNotFoundException.class, () -> architectureStore.getArchitectureForVersion(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testGetArchitectureForVersion_whenVersionExists_returnsArchitecture() throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("1-0-0", VALID_JSON);

        Document architectureDoc = Document.createDocument()
                .put("architectureId", ARCHITECTURE_ID)
                .put("versions", versions);

        List<Document> architectures = new ArrayList<>();
        architectures.add(architectureDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", architectures);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION)
                .build();

        // Act
        String result = architectureStore.getArchitectureForVersion(architecture);

        // Assert
        assertThat(result, is(VALID_JSON));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateArchitectureForVersion_whenNamespaceDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION)
                .setArchitecture(VALID_JSON)
                .build();

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> architectureStore.createArchitectureForVersion(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateArchitectureForVersion_whenVersionExists_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("1-0-0", VALID_JSON);

        Document architectureDoc = Document.createDocument()
                .put("architectureId", ARCHITECTURE_ID)
                .put("versions", versions);

        List<Document> architectures = new ArrayList<>();
        architectures.add(architectureDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", architectures);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION)
                .setArchitecture(VALID_JSON)
                .build();

        // Act & Assert
        assertThrows(ArchitectureVersionExistsException.class, () -> architectureStore.createArchitectureForVersion(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testCreateArchitectureForVersion_whenVersionDoesNotExist_createsVersion() throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("2-0-0", VALID_JSON); // Different version

        Document architectureDoc = Document.createDocument()
                .put("architectureId", ARCHITECTURE_ID)
                .put("versions", versions);

        List<Document> architectures = new ArrayList<>();
        architectures.add(architectureDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", architectures);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION) // 1.0.0
                .setArchitecture(VALID_JSON)
                .build();

        // Act
        Architecture result = architectureStore.createArchitectureForVersion(architecture);

        // Assert
        assertThat(result, is(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void testVersionExists_whenVersionDoesNotExist_returnsFalse() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("2-0-0", VALID_JSON); // Different version

        Document architectureDoc = Document.createDocument()
                .put("architectureId", ARCHITECTURE_ID)
                .put("versions", versions);

        List<Document> architectures = new ArrayList<>();
        architectures.add(architectureDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", architectures);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION) // 1.0.0
                .setArchitecture(VALID_JSON)
                .build();

        // Act & Assert
        assertDoesNotThrow(() -> architectureStore.createArchitectureForVersion(architecture));
    }

    @Test
    public void testUpdateArchitectureForVersion_whenNamespaceDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);
        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION)
                .setArchitecture(VALID_JSON)
                .build();

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> architectureStore.updateArchitectureForVersion(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testUpdateArchitectureForVersion_whenArchitectureDoesNotExist_throwsException() {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setVersion(VERSION)
                .setArchitecture(VALID_JSON)
                .build();

        // Act & Assert
        assertThrows(ArchitectureNotFoundException.class, () -> architectureStore.updateArchitectureForVersion(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
    }

    @Test
    public void testUpdateArchitectureForVersion_whenValidParameters_returnsUpdatedArchitecture() throws NamespaceNotFoundException, ArchitectureNotFoundException {
        // Arrange
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versions = Document.createDocument()
                .put("1-0-0", VALID_JSON);

        Document architectureDoc = Document.createDocument()
                .put("architectureId", ARCHITECTURE_ID)
                .put("versions", versions);

        List<Document> architectures = new ArrayList<>();
        architectures.add(architectureDoc);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("architectures", architectures);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        Architecture architecture = new Architecture.ArchitectureBuilder()
                .setNamespace(NAMESPACE)
                .setId(ARCHITECTURE_ID)
                .setName(ARCHITECTURE_NAME)
                .setDescription(ARCHITECTURE_DESCRIPTION)
                .setVersion(VERSION)
                .setArchitecture(VALID_JSON)
                .build();

        // Act
        Architecture result = architectureStore.updateArchitectureForVersion(architecture);

        // Assert
        assertThat(result, is(architecture));
        verify(mockNamespaceStore, atLeastOnce()).namespaceExists(NAMESPACE);
        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }
}
