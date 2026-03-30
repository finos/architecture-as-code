package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionExistsException;
import org.finos.calm.domain.exception.ControlConfigurationVersionNotFoundException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionExistsException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteControlStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    @Mock
    private NitriteDomainStore mockDomainStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteControlStore controlStore;

    private static final String TEST_DOMAIN = "security";
    private static final String INVALID_DOMAIN = "invalid-domain";

    @BeforeEach
    public void setup() {
        when(mockDb.getCollection(anyString())).thenReturn(mockCollection);
        controlStore = new NitriteControlStore(mockDb, mockDomainStore, mockCounterStore);
    }

    @Test
    public void testGetControlsForDomain_whenDomainDoesNotExist_throwsDomainNotFoundException() {
        // Arrange
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));

        // Act & Assert
        assertThrows(DomainNotFoundException.class, () -> 
            controlStore.getControlsForDomain(INVALID_DOMAIN));
    }

    @Test
    public void testGetControlsForDomain_whenDomainExistsButNoControls_returnsEmptyList() throws DomainNotFoundException {
        // Arrange
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.iterator()).thenReturn(Collections.emptyIterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act
        List<ControlDetail> result = controlStore.getControlsForDomain(TEST_DOMAIN);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    public void testGetControlsForDomain_whenDomainExistsWithNullControls_returnsEmptyList() throws DomainNotFoundException {
        // Arrange
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", null);

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.iterator()).thenReturn(Arrays.asList(domainDoc).iterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act
        List<ControlDetail> result = controlStore.getControlsForDomain(TEST_DOMAIN);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.isEmpty(), is(true));
    }

    @Test
    public void testGetControlsForDomain_whenDomainExistsWithControls_returnsControlList() throws DomainNotFoundException {
        // Arrange
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));

        Document control1 = Document.createDocument()
                .put("controlId", 1)
                .put("name", "Access Control")
                .put("description", "Manage user access");

        Document control2 = Document.createDocument()
                .put("controlId", 2)
                .put("name", "Data Encryption")
                .put("description", "Encrypt sensitive data");

        List<Document> controls = Arrays.asList(control1, control2);

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", controls);

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.iterator()).thenReturn(Arrays.asList(domainDoc).iterator());
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        // Act
        List<ControlDetail> result = controlStore.getControlsForDomain(TEST_DOMAIN);

        // Assert
        assertThat(result, hasSize(2));
        assertThat(result.get(0).getId(), is(1));
        assertThat(result.get(0).getName(), is("Access Control"));
        assertThat(result.get(0).getDescription(), is("Manage user access"));
        assertThat(result.get(1).getId(), is(2));
        assertThat(result.get(1).getName(), is("Data Encryption"));
        assertThat(result.get(1).getDescription(), is("Encrypt sensitive data"));
    }

    @Test
    public void testCreateControlRequirement_whenDomainDoesNotExist_throwsDomainNotFoundException() {
        // Arrange
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        CreateControlRequirement createRequest = new CreateControlRequirement(
            "Test Control", "Test Description", "{}"
        );

        // Act & Assert
        assertThrows(DomainNotFoundException.class, () -> 
            controlStore.createControlRequirement(createRequest, INVALID_DOMAIN));
    }

    @Test
    public void testCreateControlRequirement_whenDomainDoesNotExistInCollection_createsNewDomainDocument() throws DomainNotFoundException {
        // Arrange
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        when(mockCounterStore.getNextControlSequenceValue()).thenReturn(5);

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        CreateControlRequirement createRequest = new CreateControlRequirement(
            "New Control", "New Description", "{\"type\": \"control\"}"
        );

        // Act
        ControlDetail result = controlStore.createControlRequirement(createRequest, TEST_DOMAIN);

        // Assert
        assertThat(result.getId(), is(5));
        assertThat(result.getName(), is("New Control"));
        assertThat(result.getDescription(), is("New Description"));

        verify(mockCollection).insert(any(Document.class));
        verify(mockCounterStore).getNextControlSequenceValue();
    }

    @Test
    public void testCreateControlRequirement_whenDomainExistsWithNullControls_updatesDocument() throws DomainNotFoundException {
        // Arrange
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        when(mockCounterStore.getNextControlSequenceValue()).thenReturn(10);

        Document existingDomainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", null);

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(existingDomainDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        CreateControlRequirement createRequest = new CreateControlRequirement(
            "Another Control", "Another Description", "{\"requirement\": \"strict\"}"
        );

        // Act
        ControlDetail result = controlStore.createControlRequirement(createRequest, TEST_DOMAIN);

        // Assert
        assertThat(result.getId(), is(10));
        assertThat(result.getName(), is("Another Control"));
        assertThat(result.getDescription(), is("Another Description"));

        verify(mockCollection).update(any(Filter.class), any(Document.class));
        verify(mockCounterStore).getNextControlSequenceValue();
    }

    @Test
    public void testCreateControlRequirement_whenDomainExistsWithExistingControls_addsToExistingList() throws DomainNotFoundException {
        // Arrange
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        when(mockCounterStore.getNextControlSequenceValue()).thenReturn(15);

        Document existingControl = Document.createDocument()
                .put("controlId", 1)
                .put("name", "Existing Control")
                .put("description", "Existing Description");

        List<Document> existingControls = Arrays.asList(existingControl);

        Document existingDomainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", existingControls);

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(existingDomainDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        CreateControlRequirement createRequest = new CreateControlRequirement(
            "Additional Control", "Additional Description", "{\"level\": \"high\"}"
        );

        // Act
        ControlDetail result = controlStore.createControlRequirement(createRequest, TEST_DOMAIN);

        // Assert
        assertThat(result.getId(), is(15));
        assertThat(result.getName(), is("Additional Control"));
        assertThat(result.getDescription(), is("Additional Description"));

        verify(mockCollection).update(any(Filter.class), any(Document.class));
        verify(mockCounterStore).getNextControlSequenceValue();
    }

    @Test
    public void testCreateControlRequirement_storesRequirementJsonCorrectly() throws DomainNotFoundException {
        // Arrange
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        when(mockCounterStore.getNextControlSequenceValue()).thenReturn(20);

        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        String complexJson = "{\"type\":\"control\",\"severity\":\"high\",\"categories\":[\"security\",\"compliance\"]}";
        CreateControlRequirement createRequest = new CreateControlRequirement(
            "JSON Control", "Control with complex JSON", complexJson
        );

        // Act
        ControlDetail result = controlStore.createControlRequirement(createRequest, TEST_DOMAIN);

        // Assert
        assertThat(result.getId(), is(20));
        assertThat(result.getName(), is("JSON Control"));
        assertThat(result.getDescription(), is("Control with complex JSON"));

        // Verify that the document was inserted with the requirement in versioned format
        verify(mockCollection).insert(argThat((Document doc) -> {
            @SuppressWarnings("unchecked")
            List<Document> controls = doc.get("controls", List.class);
            if (controls != null && !controls.isEmpty()) {
                Document controlDoc = controls.get(0);
                Document requirement = controlDoc.get("requirement", Document.class);
                return requirement != null && complexJson.equals(requirement.get("1-0-0", String.class));
            }
            return false;
        }));
    }

    // --- Helper to build a domain document with a control containing requirement versions and configurations ---

    private Document buildControlWithVersionsAndConfigs() {
        Document requirementVersions = Document.createDocument()
                .put("1-0-0", "{\"type\":\"req\"}")
                .put("2-0-0", "{\"type\":\"req-v2\"}");

        Document configVersions = Document.createDocument()
                .put("1-0-0", "{\"setting\":\"val\"}");

        Document config = Document.createDocument()
                .put("configurationId", 10)
                .put("versions", configVersions);

        Document controlDoc = Document.createDocument()
                .put("controlId", 1)
                .put("name", "Test Control")
                .put("description", "Test Desc")
                .put("requirement", requirementVersions)
                .put("configurations", Arrays.asList(config));

        return Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", Arrays.asList(controlDoc));
    }

    private void setupDomainDocReturn(Document domainDoc) {
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(domainDoc);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
    }

    // --- getRequirementVersions ---

    @Test
    public void testGetRequirementVersions_happyPath() throws Exception {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        List<String> versions = controlStore.getRequirementVersions(TEST_DOMAIN, 1);

        assertThat(versions, hasSize(2));
        assertThat(versions, containsInAnyOrder("1.0.0", "2.0.0"));
    }

    @Test
    public void testGetRequirementVersions_throwsDomainNotFoundException() {
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        assertThrows(DomainNotFoundException.class, () -> controlStore.getRequirementVersions(INVALID_DOMAIN, 1));
    }

    @Test
    public void testGetRequirementVersions_throwsControlNotFoundException() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        assertThrows(ControlNotFoundException.class, () -> controlStore.getRequirementVersions(TEST_DOMAIN, 999));
    }

    @Test
    public void testGetRequirementVersions_nullRequirement_returnsEmpty() throws Exception {
        Document controlDoc = Document.createDocument()
                .put("controlId", 1)
                .put("name", "No Req")
                .put("description", "Desc")
                .put("requirement", null)
                .put("configurations", new ArrayList<>());

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", Arrays.asList(controlDoc));

        setupDomainDocReturn(domainDoc);

        List<String> versions = controlStore.getRequirementVersions(TEST_DOMAIN, 1);
        assertThat(versions, is(empty()));
    }

    // --- getRequirementForVersion ---

    @Test
    public void testGetRequirementForVersion_happyPath() throws Exception {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        String result = controlStore.getRequirementForVersion(TEST_DOMAIN, 1, "1.0.0");
        assertThat(result, is("{\"type\":\"req\"}"));
    }

    @Test
    public void testGetRequirementForVersion_throwsVersionNotFoundForMissingVersion() throws Exception {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        assertThrows(ControlRequirementVersionNotFoundException.class,
                () -> controlStore.getRequirementForVersion(TEST_DOMAIN, 1, "9.9.9"));
    }

    @Test
    public void testGetRequirementForVersion_throwsVersionNotFoundForNullRequirement() throws Exception {
        Document controlDoc = Document.createDocument()
                .put("controlId", 1)
                .put("name", "No Req")
                .put("description", "Desc")
                .put("requirement", null)
                .put("configurations", new ArrayList<>());

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", Arrays.asList(controlDoc));

        setupDomainDocReturn(domainDoc);
        assertThrows(ControlRequirementVersionNotFoundException.class,
                () -> controlStore.getRequirementForVersion(TEST_DOMAIN, 1, "1.0.0"));
    }

    @Test
    public void testGetRequirementForVersion_throwsControlNotFoundException() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        assertThrows(ControlNotFoundException.class,
                () -> controlStore.getRequirementForVersion(TEST_DOMAIN, 999, "1.0.0"));
    }

    // --- getConfigurationsForControl ---

    @Test
    public void testGetConfigurationsForControl_happyPath() throws Exception {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        List<Integer> configs = controlStore.getConfigurationsForControl(TEST_DOMAIN, 1);
        assertThat(configs, hasSize(1));
        assertThat(configs.get(0), is(10));
    }

    @Test
    public void testGetConfigurationsForControl_nullConfigurations_returnsEmpty() throws Exception {
        Document controlDoc = Document.createDocument()
                .put("controlId", 1)
                .put("name", "No Cfg")
                .put("description", "Desc")
                .put("requirement", Document.createDocument())
                .put("configurations", null);

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", Arrays.asList(controlDoc));

        setupDomainDocReturn(domainDoc);

        List<Integer> configs = controlStore.getConfigurationsForControl(TEST_DOMAIN, 1);
        assertThat(configs, is(empty()));
    }

    @Test
    public void testGetConfigurationsForControl_throwsControlNotFoundException() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        assertThrows(ControlNotFoundException.class,
                () -> controlStore.getConfigurationsForControl(TEST_DOMAIN, 999));
    }

    // --- getConfigurationVersions ---

    @Test
    public void testGetConfigurationVersions_happyPath() throws Exception {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        List<String> versions = controlStore.getConfigurationVersions(TEST_DOMAIN, 1, 10);
        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), is("1.0.0"));
    }

    @Test
    public void testGetConfigurationVersions_throwsConfigNotFound() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        assertThrows(ControlConfigurationNotFoundException.class,
                () -> controlStore.getConfigurationVersions(TEST_DOMAIN, 1, 999));
    }

    @Test
    public void testGetConfigurationVersions_nullVersions_returnsEmpty() throws Exception {
        Document config = Document.createDocument()
                .put("configurationId", 10)
                .put("versions", null);

        Document controlDoc = Document.createDocument()
                .put("controlId", 1)
                .put("name", "Test")
                .put("description", "Desc")
                .put("requirement", Document.createDocument())
                .put("configurations", Arrays.asList(config));

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", Arrays.asList(controlDoc));

        setupDomainDocReturn(domainDoc);

        List<String> versions = controlStore.getConfigurationVersions(TEST_DOMAIN, 1, 10);
        assertThat(versions, is(empty()));
    }

    // --- getConfigurationForVersion ---

    @Test
    public void testGetConfigurationForVersion_happyPath() throws Exception {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        String result = controlStore.getConfigurationForVersion(TEST_DOMAIN, 1, 10, "1.0.0");
        assertThat(result, is("{\"setting\":\"val\"}"));
    }

    @Test
    public void testGetConfigurationForVersion_throwsVersionNotFound() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        assertThrows(ControlConfigurationVersionNotFoundException.class,
                () -> controlStore.getConfigurationForVersion(TEST_DOMAIN, 1, 10, "9.9.9"));
    }

    @Test
    public void testGetConfigurationForVersion_throwsVersionNotFoundWhenNullVersions() throws Exception {
        Document config = Document.createDocument()
                .put("configurationId", 10)
                .put("versions", null);

        Document controlDoc = Document.createDocument()
                .put("controlId", 1)
                .put("name", "Test")
                .put("description", "Desc")
                .put("requirement", Document.createDocument())
                .put("configurations", Arrays.asList(config));

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", Arrays.asList(controlDoc));

        setupDomainDocReturn(domainDoc);
        assertThrows(ControlConfigurationVersionNotFoundException.class,
                () -> controlStore.getConfigurationForVersion(TEST_DOMAIN, 1, 10, "1.0.0"));
    }

    @Test
    public void testGetConfigurationForVersion_throwsConfigNotFound() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        assertThrows(ControlConfigurationNotFoundException.class,
                () -> controlStore.getConfigurationForVersion(TEST_DOMAIN, 1, 999, "1.0.0"));
    }

    // --- findControl edge cases ---

    @Test
    public void testFindControl_throwsControlNotFoundWhenDomainDocNull() {
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        DocumentCursor mockCursor = mock(DocumentCursor.class);
        when(mockCursor.firstOrNull()).thenReturn(null);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);

        assertThrows(ControlNotFoundException.class,
                () -> controlStore.getRequirementVersions(TEST_DOMAIN, 1));
    }

    @Test
    public void testFindControl_throwsControlNotFoundWhenControlsListNull() {
        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", null);

        setupDomainDocReturn(domainDoc);

        assertThrows(ControlNotFoundException.class,
                () -> controlStore.getRequirementVersions(TEST_DOMAIN, 1));
    }

    // --- createRequirementForVersion ---

    @Test
    public void testCreateRequirementForVersion_happyPath() throws Exception {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        controlStore.createRequirementForVersion(TEST_DOMAIN, 1, "3.0.0", "{\"type\":\"req-v3\"}");

        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void testCreateRequirementForVersion_throwsWhenVersionAlreadyExists() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        assertThrows(ControlRequirementVersionExistsException.class,
                () -> controlStore.createRequirementForVersion(TEST_DOMAIN, 1, "1.0.0", "{}"));
    }

    @Test
    public void testCreateRequirementForVersion_throwsDomainNotFoundException() {
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        assertThrows(DomainNotFoundException.class,
                () -> controlStore.createRequirementForVersion(INVALID_DOMAIN, 1, "2.0.0", "{}"));
    }

    @Test
    public void testCreateRequirementForVersion_throwsControlNotFoundException() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        assertThrows(ControlNotFoundException.class,
                () -> controlStore.createRequirementForVersion(TEST_DOMAIN, 999, "2.0.0", "{}"));
    }

    @Test
    public void testCreateRequirementForVersion_createsRequirementWhenNull() throws Exception {
        Document controlDoc = Document.createDocument()
                .put("controlId", 1)
                .put("name", "No Req")
                .put("description", "Desc")
                .put("requirement", null)
                .put("configurations", new ArrayList<>());

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", Arrays.asList(controlDoc));

        setupDomainDocReturn(domainDoc);

        controlStore.createRequirementForVersion(TEST_DOMAIN, 1, "1.0.0", "{\"type\":\"new\"}");

        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }

    // --- createControlConfiguration ---

    @Test
    public void testCreateControlConfiguration_happyPath() throws Exception {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        when(mockCounterStore.getNextControlConfigurationSequenceValue()).thenReturn(42);

        CreateControlConfiguration request = new CreateControlConfiguration("{\"setting\":\"enabled\"}");
        int configId = controlStore.createControlConfiguration(request, TEST_DOMAIN, 1);

        assertThat(configId, is(42));
        verify(mockCollection).update(any(Filter.class), any(Document.class));
        verify(mockCounterStore).getNextControlConfigurationSequenceValue();
    }

    @Test
    public void testCreateControlConfiguration_throwsDomainNotFoundException() {
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        CreateControlConfiguration request = new CreateControlConfiguration("{}");

        assertThrows(DomainNotFoundException.class,
                () -> controlStore.createControlConfiguration(request, INVALID_DOMAIN, 1));
    }

    @Test
    public void testCreateControlConfiguration_throwsControlNotFoundException() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        CreateControlConfiguration request = new CreateControlConfiguration("{}");

        assertThrows(ControlNotFoundException.class,
                () -> controlStore.createControlConfiguration(request, TEST_DOMAIN, 999));
    }

    @Test
    public void testCreateControlConfiguration_whenNullConfigurationsList() throws Exception {
        Document controlDoc = Document.createDocument()
                .put("controlId", 1)
                .put("name", "Test")
                .put("description", "Desc")
                .put("requirement", Document.createDocument())
                .put("configurations", null);

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", Arrays.asList(controlDoc));

        setupDomainDocReturn(domainDoc);
        when(mockCounterStore.getNextControlConfigurationSequenceValue()).thenReturn(5);

        CreateControlConfiguration request = new CreateControlConfiguration("{\"setting\":\"val\"}");
        int configId = controlStore.createControlConfiguration(request, TEST_DOMAIN, 1);

        assertThat(configId, is(5));
        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }

    // --- createConfigurationForVersion ---

    @Test
    public void testCreateConfigurationForVersion_happyPath() throws Exception {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        controlStore.createConfigurationForVersion(TEST_DOMAIN, 1, 10, "2.0.0", "{\"setting\":\"v2\"}");

        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }

    @Test
    public void testCreateConfigurationForVersion_throwsWhenVersionAlreadyExists() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        assertThrows(ControlConfigurationVersionExistsException.class,
                () -> controlStore.createConfigurationForVersion(TEST_DOMAIN, 1, 10, "1.0.0", "{}"));
    }

    @Test
    public void testCreateConfigurationForVersion_throwsConfigNotFound() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());

        assertThrows(ControlConfigurationNotFoundException.class,
                () -> controlStore.createConfigurationForVersion(TEST_DOMAIN, 1, 999, "2.0.0", "{}"));
    }

    @Test
    public void testCreateConfigurationForVersion_throwsDomainNotFoundException() {
        when(mockDomainStore.getDomains()).thenReturn(List.of(TEST_DOMAIN));
        assertThrows(DomainNotFoundException.class,
                () -> controlStore.createConfigurationForVersion(INVALID_DOMAIN, 1, 10, "2.0.0", "{}"));
    }

    @Test
    public void testCreateConfigurationForVersion_throwsControlNotFoundException() {
        setupDomainDocReturn(buildControlWithVersionsAndConfigs());
        assertThrows(ControlNotFoundException.class,
                () -> controlStore.createConfigurationForVersion(TEST_DOMAIN, 999, 10, "2.0.0", "{}"));
    }

    @Test
    public void testCreateConfigurationForVersion_createsVersionsWhenNull() throws Exception {
        Document config = Document.createDocument()
                .put("configurationId", 10)
                .put("versions", null);

        Document controlDoc = Document.createDocument()
                .put("controlId", 1)
                .put("name", "Test")
                .put("description", "Desc")
                .put("requirement", Document.createDocument())
                .put("configurations", Arrays.asList(config));

        Document domainDoc = Document.createDocument()
                .put("domain", TEST_DOMAIN)
                .put("controls", Arrays.asList(controlDoc));

        setupDomainDocReturn(domainDoc);

        controlStore.createConfigurationForVersion(TEST_DOMAIN, 1, 10, "1.0.0", "{\"setting\":\"new\"}");

        verify(mockCollection).update(any(Filter.class), any(Document.class));
    }
}