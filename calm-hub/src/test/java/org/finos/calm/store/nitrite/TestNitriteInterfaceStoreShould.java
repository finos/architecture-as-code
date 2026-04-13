package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
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
public class TestNitriteInterfaceStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteInterfaceStore interfaceStore;

    private final String NAMESPACE = "finos";
    private final String INTERFACE_JSON = "{\"type\":\"object\",\"properties\":{\"port\":{\"type\":\"integer\"}}}";
    private final int INTERFACE_ID = 42;

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        interfaceStore = new NitriteInterfaceStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    @Test
    public void testGetInterfacesForNamespace_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> interfaceStore.getInterfacesForNamespace(NAMESPACE));
    }

    @Test
    public void testGetInterfacesForNamespace_whenNoInterfaces_returnsEmptyList() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        List<NamespaceInterfaceSummary> result = interfaceStore.getInterfacesForNamespace(NAMESPACE);

        assertThat(result, is(notNullValue()));
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    public void testGetInterfacesForNamespace_whenNamespaceExistsButInterfacesArrayIsNull_returnsEmptyList() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("interfaces", null);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<NamespaceInterfaceSummary> result = interfaceStore.getInterfacesForNamespace(NAMESPACE);

        assertThat(result, is(notNullValue()));
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    public void testGetInterfacesForNamespace_whenNamespaceExistsButInterfacesArrayIsEmpty_returnsEmptyList() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("interfaces", Collections.emptyList());

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<NamespaceInterfaceSummary> result = interfaceStore.getInterfacesForNamespace(NAMESPACE);

        assertThat(result, is(notNullValue()));
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    public void testGetInterfacesForNamespace_whenInterfacesExist_returnsInterfaces() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Map<String, Object> fullInterface = new HashMap<>();
        fullInterface.put("interfaceId", 2);
        fullInterface.put("name", "Test Name");
        fullInterface.put("description", "Test Description");

        Document interfaceDoc1 = Document.createDocument("interfaceId", 1);
        Document interfaceDoc2 = Document.createDocument(fullInterface);
        List<Document> interfaces = Arrays.asList(interfaceDoc1, interfaceDoc2);

        Document namespaceDoc = Document.createDocument()
                .put("namespace", NAMESPACE)
                .put("interfaces", interfaces);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<NamespaceInterfaceSummary> result = interfaceStore.getInterfacesForNamespace(NAMESPACE);

        assertThat(result, is(notNullValue()));
        assertThat(result.size(), is(2));
        assertThat(result.getFirst().getId(), is(1));
        assertThat(result.get(1).getId(), is(2));
        assertThat(result.get(1).getDescription(), is("Test Description"));
        assertThat(result.get(1).getName(), is("Test Name"));
    }

    @Test
    public void testCreateInterfaceForNamespace_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        CreateInterfaceRequest interfaceRequest = new CreateInterfaceRequest();
        interfaceRequest.setInterfaceJson(INTERFACE_JSON);

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> interfaceStore.createInterfaceForNamespace(interfaceRequest, NAMESPACE));
    }

    @Test
    public void testCreateInterfaceForNamespace_whenNamespaceExists_createsInterface() throws NamespaceNotFoundException {
        CreateInterfaceRequest interfaceRequest = new CreateInterfaceRequest();
        interfaceRequest.setInterfaceJson(INTERFACE_JSON);

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCounterStore.getNextInterfaceSequenceValue()).thenReturn(INTERFACE_ID);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        CalmInterface result = interfaceStore.createInterfaceForNamespace(interfaceRequest, NAMESPACE);

        assertThat(result, is(notNullValue()));
        assertThat(result.getId(), is(INTERFACE_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getInterfaceJson(), is(INTERFACE_JSON));
        assertThat(result.getVersion(), is("1.0.0"));

        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void testGetInterfaceVersions_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> interfaceStore.getInterfaceVersions(NAMESPACE, INTERFACE_ID));
    }

    @Test
    public void testGetInterfaceVersions_whenInterfaceDoesNotExist_throwsInterfaceNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mock(DocumentCursor.class));

        assertThrows(InterfaceNotFoundException.class, () -> interfaceStore.getInterfaceVersions(NAMESPACE, INTERFACE_ID));
    }

    @Test
    public void testGetInterfaceVersions_whenVersionsExist_returnsVersionsList() throws NamespaceNotFoundException, InterfaceNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versionsDoc = mock(Document.class);
        when(versionsDoc.getFields()).thenReturn(new HashSet<>(Arrays.asList("1-0-0", "1-1-0")));

        Document interfaceDoc = mock(Document.class);
        when(interfaceDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(interfaceDoc.get("interfaceId", Integer.class)).thenReturn(INTERFACE_ID);

        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("interfaces"), any())).thenReturn(Collections.singletonList(interfaceDoc));

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        List<String> result = interfaceStore.getInterfaceVersions(NAMESPACE, INTERFACE_ID);

        assertThat(result, is(notNullValue()));
        assertThat(result.size(), is(2));
        assertThat(result, hasItem("1.0.0"));
        assertThat(result, hasItem("1.1.0"));
    }

    @Test
    public void testGetInterfaceForVersion_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> interfaceStore.getInterfaceForVersion(NAMESPACE, INTERFACE_ID, "1.0.0"));
    }

    @Test
    public void testGetInterfaceForVersion_whenInterfaceDoesNotExist_throwsInterfaceNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        assertThrows(InterfaceNotFoundException.class, () -> interfaceStore.getInterfaceForVersion(NAMESPACE, INTERFACE_ID, "1.0.0"));
    }

    @Test
    public void testGetInterfaceForVersion_whenVersionDoesNotExist_throwsInterfaceVersionNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versionsDoc = mock(Document.class);
        when(versionsDoc.get("2-0-0", String.class)).thenReturn(null);

        Document interfaceDoc = mock(Document.class);
        when(interfaceDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(interfaceDoc.get("interfaceId", Integer.class)).thenReturn(INTERFACE_ID);

        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("interfaces"), any())).thenReturn(Collections.singletonList(interfaceDoc));

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        assertThrows(InterfaceVersionNotFoundException.class, () -> interfaceStore.getInterfaceForVersion(NAMESPACE, INTERFACE_ID, "2.0.0"));
    }

    @Test
    public void testGetInterfaceForVersion_whenVersionExists_returnsInterface() throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionNotFoundException {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versionsDoc = mock(Document.class);
        when(versionsDoc.get(eq("2-0-0"), any())).thenReturn("{}");

        Document interfaceDoc = mock(Document.class);
        when(interfaceDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(interfaceDoc.get("interfaceId", Integer.class)).thenReturn(INTERFACE_ID);

        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("interfaces"), any())).thenReturn(Collections.singletonList(interfaceDoc));

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        String result = interfaceStore.getInterfaceForVersion(NAMESPACE, INTERFACE_ID, "2.0.0");

        assertThat(result, equalTo("{}"));
    }

    @Test
    public void testCreateInterfaceForVersion_whenNamespaceDoesNotExist_throwsNamespaceNotFoundException() {
        CreateInterfaceRequest interfaceRequest = getInterfaceToPersist();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> interfaceStore.createInterfaceForVersion(interfaceRequest, NAMESPACE, null, null));
    }

    private CreateInterfaceRequest getInterfaceToPersist() {
        return new CreateInterfaceRequest("Test", "Test Description", INTERFACE_JSON);
    }

    @Test
    public void testCreateInterfaceForVersion_whenNamespaceDocumentDoesNotExist_throwsInterfaceNotFoundException() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        assertThrows(InterfaceNotFoundException.class, () -> interfaceStore.createInterfaceForVersion(getInterfaceToPersist(), NAMESPACE, null, null));
    }

    @Test
    public void testCreateInterfaceForVersion_whenInterfaceDoesNotExist_throwsInterfaceNotFoundException() {
        CreateInterfaceRequest interfaceRequest = getInterfaceToPersist();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document namespaceDoc = mock(Document.class);

        DocumentCursor namespaceCursor = mock(DocumentCursor.class);
        when(namespaceCursor.firstOrNull()).thenReturn(namespaceDoc);

        DocumentCursor interfaceCursor = mock(DocumentCursor.class);
        when(interfaceCursor.firstOrNull()).thenReturn(null);

        when(mockCollection.find(any(Filter.class))).thenReturn(namespaceCursor, interfaceCursor);

        assertThrows(InterfaceNotFoundException.class, () -> interfaceStore.createInterfaceForVersion(interfaceRequest, NAMESPACE, INTERFACE_ID, null));
    }

    @Test
    public void testCreateInterfaceForVersion_whenVersionAlreadyExists_throwsInterfaceVersionExistsException() {
        CreateInterfaceRequest interfaceRequest = getInterfaceToPersist();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versionsDoc = mock(Document.class);
        when(versionsDoc.containsKey(anyString())).thenReturn(true);

        Document interfaceDoc = mock(Document.class);
        when(interfaceDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(interfaceDoc.get("interfaceId", Integer.class)).thenReturn(INTERFACE_ID);

        List<Document> interfaces = Collections.singletonList(interfaceDoc);

        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("interfaces"), any())).thenReturn(interfaces);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        assertThrows(InterfaceVersionExistsException.class, () -> interfaceStore.createInterfaceForVersion(interfaceRequest, NAMESPACE, INTERFACE_ID, "1.0.0"));
    }

    @Test
    public void testCreateInterfaceForVersion_whenSuccess_returnsInterface() throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionExistsException {
        CreateInterfaceRequest createInterfaceRequest = getInterfaceToPersist();

        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        Document versionsDoc = mock(Document.class);
        when(versionsDoc.containsKey(anyString())).thenReturn(false);

        Document interfaceDoc = mock(Document.class);
        when(interfaceDoc.get(eq("versions"), any())).thenReturn(versionsDoc);
        when(interfaceDoc.get("interfaceId", Integer.class)).thenReturn(INTERFACE_ID);

        List<Document> interfaces = new ArrayList<>();
        interfaces.add(interfaceDoc);

        Document namespaceDoc = mock(Document.class);
        when(namespaceDoc.get(eq("interfaces"), any())).thenReturn(interfaces);

        DocumentCursor cursor = mock(DocumentCursor.class);
        when(cursor.firstOrNull()).thenReturn(namespaceDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(cursor);

        CalmInterface result = interfaceStore.createInterfaceForVersion(createInterfaceRequest, NAMESPACE, INTERFACE_ID, "1.0.0");

        assertThat(result, is(notNullValue()));
        assertThat(result.getId(), is(INTERFACE_ID));
        assertThat(result.getNamespace(), is(NAMESPACE));
        assertThat(result.getVersion(), is("1.0.0"));
    }
}
