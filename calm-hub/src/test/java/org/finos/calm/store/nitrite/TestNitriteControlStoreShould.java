package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.controls.ControlConfigDetail;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Store-level tests for Control's header/version shape (ADR 0007), mirroring
 * {@code TestMongoControlStoreShould}. Document mechanics shared with every other type are
 * covered by {@code TestNitriteVersionDocumentStoreShould}; what this class pins is
 * Control-specific glue: two composed stores (requirement, configuration), the synthetic
 * {@code domain::controlId} configuration namespace, and that only a requirement version
 * write syncs the wrapper name/description.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class TestNitriteControlStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteDomainStore domainStore;

    @Mock
    private NitriteCounterStore counterStore;

    private NitriteCollection controlHeaders;
    private NitriteCollection controlVersions;
    private NitriteCollection configHeaders;
    private NitriteCollection configVersions;
    private NitriteControlStore store;

    private static final String DOMAIN = "security";
    private static final int CONTROL_ID = 1;
    private static final int CONFIGURATION_ID = 10;
    private static final String CONFIG_NAMESPACE = DOMAIN + "::" + CONTROL_ID;
    private static final String VALID_JSON = "{\"setting\": \"enabled\"}";

    @BeforeEach
    void setup() {
        controlHeaders = mock(NitriteCollection.class);
        controlVersions = mock(NitriteCollection.class);
        configHeaders = mock(NitriteCollection.class);
        configVersions = mock(NitriteCollection.class);

        when(mockDb.getCollection("controls")).thenReturn(controlHeaders);
        when(mockDb.getCollection("controlVersions")).thenReturn(controlVersions);
        when(mockDb.getCollection("controlConfigurations")).thenReturn(configHeaders);
        when(mockDb.getCollection("controlConfigurationVersions")).thenReturn(configVersions);
        when(domainStore.getDomains()).thenReturn(List.of(DOMAIN));

        store = new NitriteControlStore(mockDb, domainStore, counterStore);
    }

    private void stubFind(NitriteCollection collection, List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(collection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(collection.find()).thenReturn(cursor);
    }

    private void controlExists() {
        stubFind(controlHeaders, List.of(Document.createDocument().put("controlId", CONTROL_ID).put("versionCount", 1)));
        stubFind(controlVersions, List.of());
    }

    private void controlDoesNotExist() {
        stubFind(controlHeaders, List.of());
    }

    private void configurationExists() {
        controlExists();
        stubFind(configHeaders, List.of(Document.createDocument().put("configurationId", CONFIGURATION_ID).put("versionCount", 1)));
        stubFind(configVersions, List.of());
    }

    private void configurationDoesNotExist() {
        controlExists();
        stubFind(configHeaders, List.of());
    }

    // --- getControlsForDomain ---

    @Test
    void get_controls_for_domain_throws_when_domain_does_not_exist() {
        assertThrows(DomainNotFoundException.class, () -> store.getControlsForDomain("invalid-domain"));
    }

    @Test
    void get_controls_for_domain_returns_empty_list_when_domain_has_no_controls() throws DomainNotFoundException {
        stubFind(controlHeaders, List.of());

        assertThat(store.getControlsForDomain(DOMAIN), is(empty()));
    }

    @Test
    void get_controls_for_domain_returns_a_detail_per_header_with_title_from_the_latest_version() throws DomainNotFoundException {
        stubFind(controlHeaders, List.of(
                Document.createDocument().put("controlId", 1).put("name", "Access Control").put("description", "Manage user access"),
                Document.createDocument().put("controlId", 2).put("name", "Encryption").put("description", "Data encryption requirements")));
        stubFind(controlVersions, List.of(Document.createDocument().put("version", "1.0.0")
                .put("content", "{\"title\":\"Access Title\"}")));

        List<ControlDetail> result = store.getControlsForDomain(DOMAIN);

        assertThat(result, hasSize(2));
        assertThat(result.get(0).getId(), is(1));
        assertThat(result.get(0).getName(), is("Access Control"));
        assertThat(result.get(0).getDescription(), is("Manage user access"));
        assertThat(result.get(0).getTitle(), is("Access Title"));
    }

    // --- createControlRequirement ---

    @Test
    void create_control_requirement_throws_when_domain_does_not_exist() {
        CreateControlRequirement request = new CreateControlRequirement("Test Control", "Test Description", "{}");

        assertThrows(DomainNotFoundException.class, () -> store.createControlRequirement(request, "invalid-domain"));
    }

    @Test
    void create_control_requirement_creates_a_header_and_an_initial_version() throws DomainNotFoundException {
        when(counterStore.getNextControlSequenceValue()).thenReturn(5);
        stubFind(controlHeaders, List.of());
        stubFind(controlVersions, List.of());

        CreateControlRequirement request = new CreateControlRequirement("New Control", "New Description", "{\"type\": \"control\"}");
        ControlDetail result = store.createControlRequirement(request, DOMAIN);

        assertThat(result.getId(), is(5));
        assertThat(result.getName(), is("New Control"));
        assertThat(result.getDescription(), is("New Description"));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlHeaders).insert(headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("controlId", Integer.class), is(5));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlVersions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        assertThat(versionCaptor.getValue().get("content", String.class), is("{\"type\": \"control\"}"));
    }

    // --- getRequirementVersions ---

    @Test
    void get_requirement_versions_throws_when_domain_not_found() {
        assertThrows(DomainNotFoundException.class, () -> store.getRequirementVersions("invalid", CONTROL_ID));
    }

    @Test
    void get_requirement_versions_throws_when_control_not_found() {
        controlDoesNotExist();

        assertThrows(ControlNotFoundException.class, () -> store.getRequirementVersions(DOMAIN, 999));
    }

    @Test
    void get_requirement_versions_returns_the_version_list() throws Exception {
        stubFind(controlHeaders, List.of(Document.createDocument().put("controlId", CONTROL_ID)));
        stubFind(controlVersions, List.of(Document.createDocument().put("version", "1.0.0")));

        assertThat(store.getRequirementVersions(DOMAIN, CONTROL_ID), contains("1.0.0"));
    }

    // --- getRequirementForVersion ---

    @Test
    void get_requirement_for_version_returns_content() throws Exception {
        stubFind(controlHeaders, List.of(Document.createDocument().put("controlId", CONTROL_ID)));
        stubFind(controlVersions, List.of(Document.createDocument().put("content", "{\"type\":\"requirement\"}")));

        assertThat(store.getRequirementForVersion(DOMAIN, CONTROL_ID, "1.0.0"), is("{\"type\":\"requirement\"}"));
    }

    @Test
    void get_requirement_for_version_throws_when_version_not_found() {
        stubFind(controlHeaders, List.of(Document.createDocument().put("controlId", CONTROL_ID)));
        stubFind(controlVersions, List.of());

        assertThrows(ControlRequirementVersionNotFoundException.class,
                () -> store.getRequirementForVersion(DOMAIN, CONTROL_ID, "9.9.9"));
    }

    @Test
    void get_requirement_for_version_throws_when_control_not_found() {
        controlDoesNotExist();

        assertThrows(ControlNotFoundException.class, () -> store.getRequirementForVersion(DOMAIN, 999, "1.0.0"));
    }

    // --- createRequirementForVersion ---

    @Test
    void create_requirement_for_version_throws_when_domain_not_found() {
        CreateControlRequirement request = new CreateControlRequirement("n", "d", "{}");

        assertThrows(DomainNotFoundException.class,
                () -> store.createRequirementForVersion("invalid", CONTROL_ID, "2.0.0", request));
    }

    @Test
    void create_requirement_for_version_throws_when_control_not_found() {
        controlDoesNotExist();
        CreateControlRequirement request = new CreateControlRequirement("n", "d", "{}");

        assertThrows(ControlNotFoundException.class,
                () -> store.createRequirementForVersion(DOMAIN, 999, "2.0.0", request));
    }

    @Test
    void create_requirement_for_version_succeeds_when_the_version_does_not_exist() throws Exception {
        controlExists();

        store.createRequirementForVersion(DOMAIN, CONTROL_ID, "2.0.0",
                new CreateControlRequirement("n", "d", "{\"type\": \"req-v2\"}"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlVersions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("2.0.0"));
    }

    @Test
    void create_requirement_for_version_throws_when_the_version_already_exists() {
        controlExists();
        stubFind(controlVersions, List.of(Document.createDocument().put("version", "1.0.0")));

        assertThrows(ControlRequirementVersionExistsException.class, () ->
                store.createRequirementForVersion(DOMAIN, CONTROL_ID, "1.0.0", new CreateControlRequirement("n", "d", "{}")));
    }

    @Test
    void create_requirement_for_version_updates_wrapper_name_and_description_from_the_envelope() throws Exception {
        controlExists();

        store.createRequirementForVersion(DOMAIN, CONTROL_ID, "2.0.0",
                new CreateControlRequirement("New Name", "New Desc", "{\"type\":\"req-v2\"}"));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        // Two header writes: the versionCount increment, then the name/description update.
        verify(controlHeaders, times(2)).update(any(Filter.class), headerCaptor.capture());
        Document updatedHeader = headerCaptor.getAllValues().get(1);
        assertThat(updatedHeader.get("name", String.class), is("New Name"));
        assertThat(updatedHeader.get("description", String.class), is("New Desc"));
    }

    @Test
    void create_requirement_for_version_leaves_the_wrapper_untouched_when_the_envelope_lacks_metadata() throws Exception {
        // Defensive: the REST layer enforces @NotBlank so a null name/description is only
        // reachable via non-REST callers (e.g. direct store usage in tests).
        controlExists();

        store.createRequirementForVersion(DOMAIN, CONTROL_ID, "2.0.0",
                new CreateControlRequirement(null, null, "{\"type\":\"req-v2\"}"));

        // Only the versionCount increment — updatePresentHeaderDetails writes nothing when
        // both name and description are absent.
        verify(controlHeaders, times(1)).update(any(Filter.class), any(Document.class));
    }

    // --- getConfigurationsForControl ---

    @Test
    void get_configurations_throws_when_control_not_found() {
        controlDoesNotExist();

        assertThrows(ControlNotFoundException.class, () -> store.getConfigurationsForControl(DOMAIN, 999));
    }

    @Test
    void get_configurations_returns_empty_when_no_configurations_exist() throws Exception {
        controlExists();
        stubFind(configHeaders, List.of());

        assertThat(store.getConfigurationsForControl(DOMAIN, CONTROL_ID), is(empty()));
    }

    @Test
    void get_configurations_returns_config_ids() throws Exception {
        controlExists();
        stubFind(configHeaders, List.of(
                Document.createDocument().put("configurationId", 10),
                Document.createDocument().put("configurationId", 20)));

        assertThat(store.getConfigurationsForControl(DOMAIN, CONTROL_ID), contains(10, 20));
    }

    // --- getConfigurationDetailsForControl ---

    @Test
    void get_configuration_details_returns_id_name_and_title_for_each_config() throws Exception {
        controlExists();
        stubFind(configHeaders, List.of(Document.createDocument().put("configurationId", 10).put("name", "encryption-config")));
        stubFind(configVersions, List.of(Document.createDocument().put("version", "1.0.0")
                .put("content", "{\"title\":\"Encryption Title\"}")));

        List<ControlConfigDetail> details = store.getConfigurationDetailsForControl(DOMAIN, CONTROL_ID);

        assertThat(details, hasSize(1));
        assertThat(details.get(0).getId(), is(10));
        assertThat(details.get(0).getName(), is("encryption-config"));
        assertThat(details.get(0).getTitle(), is("Encryption Title"));
    }

    // --- createControlConfiguration ---

    @Test
    void create_control_configuration_throws_when_domain_not_found() {
        CreateControlConfiguration request = new CreateControlConfiguration("{}");

        assertThrows(DomainNotFoundException.class,
                () -> store.createControlConfiguration(request, "invalid", CONTROL_ID));
    }

    @Test
    void create_control_configuration_throws_when_control_not_found() {
        controlDoesNotExist();
        CreateControlConfiguration request = new CreateControlConfiguration("{}");

        assertThrows(ControlNotFoundException.class, () -> store.createControlConfiguration(request, DOMAIN, 999));
    }

    @Test
    void create_control_configuration_creates_a_header_and_an_initial_version_under_the_composite_namespace() throws Exception {
        controlExists();
        when(counterStore.getNextControlConfigurationSequenceValue()).thenReturn(42);
        stubFind(configHeaders, List.of());
        stubFind(configVersions, List.of());

        CreateControlConfiguration request = new CreateControlConfiguration(VALID_JSON);
        int configId = store.createControlConfiguration(request, DOMAIN, CONTROL_ID);

        assertThat(configId, is(42));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configHeaders).insert(headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("configurationId", Integer.class), is(42));
        assertThat(headerCaptor.getValue().get("namespace", String.class), is(CONFIG_NAMESPACE));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configVersions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("namespace", String.class), is(CONFIG_NAMESPACE));
    }

    @Test
    void create_control_configuration_with_a_name_stores_it_on_the_header() throws Exception {
        controlExists();
        when(counterStore.getNextControlConfigurationSequenceValue()).thenReturn(55);
        stubFind(configHeaders, List.of());
        stubFind(configVersions, List.of());

        CreateControlConfiguration request = new CreateControlConfiguration("tls-config", "{\"cipher\":\"AES\"}");
        store.createControlConfiguration(request, DOMAIN, CONTROL_ID);

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configHeaders).insert(headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("name", String.class), is("tls-config"));
    }

    // --- getConfigurationVersions ---

    @Test
    void get_configuration_versions_throws_when_config_not_found() {
        configurationDoesNotExist();

        assertThrows(ControlConfigurationNotFoundException.class,
                () -> store.getConfigurationVersions(DOMAIN, CONTROL_ID, 999));
    }

    @Test
    void get_configuration_versions_returns_the_version_list_in_order() throws Exception {
        controlExists();
        stubFind(configHeaders, List.of(Document.createDocument().put("configurationId", CONFIGURATION_ID)));
        stubFind(configVersions, List.of(
                Document.createDocument().put("version", "2.0.0"),
                Document.createDocument().put("version", "1.0.0")));

        assertThat(store.getConfigurationVersions(DOMAIN, CONTROL_ID, CONFIGURATION_ID), contains("1.0.0", "2.0.0"));
    }

    // --- getConfigurationForVersion ---

    @Test
    void get_configuration_for_version_returns_content() throws Exception {
        configurationExists();
        stubFind(configVersions, List.of(Document.createDocument().put("content", VALID_JSON)));

        assertThat(store.getConfigurationForVersion(DOMAIN, CONTROL_ID, CONFIGURATION_ID, "1.0.0"), is(VALID_JSON));
    }

    @Test
    void get_configuration_for_version_throws_when_version_not_found() {
        configurationExists();

        assertThrows(ControlConfigurationVersionNotFoundException.class,
                () -> store.getConfigurationForVersion(DOMAIN, CONTROL_ID, CONFIGURATION_ID, "9.9.9"));
    }

    @Test
    void get_configuration_for_version_throws_when_config_not_found() {
        configurationDoesNotExist();

        assertThrows(ControlConfigurationNotFoundException.class,
                () -> store.getConfigurationForVersion(DOMAIN, CONTROL_ID, 999, "1.0.0"));
    }

    // --- createConfigurationForVersion ---

    @Test
    void create_configuration_for_version_throws_when_domain_not_found() {
        CreateControlConfiguration request = new CreateControlConfiguration("{}");

        assertThrows(DomainNotFoundException.class,
                () -> store.createConfigurationForVersion("invalid", CONTROL_ID, CONFIGURATION_ID, "2.0.0", request));
    }

    @Test
    void create_configuration_for_version_throws_when_control_not_found() {
        controlDoesNotExist();
        CreateControlConfiguration request = new CreateControlConfiguration("{}");

        assertThrows(ControlNotFoundException.class,
                () -> store.createConfigurationForVersion(DOMAIN, 999, CONFIGURATION_ID, "2.0.0", request));
    }

    @Test
    void create_configuration_for_version_throws_when_config_not_found() {
        configurationDoesNotExist();
        CreateControlConfiguration request = new CreateControlConfiguration("{}");

        assertThrows(ControlConfigurationNotFoundException.class,
                () -> store.createConfigurationForVersion(DOMAIN, CONTROL_ID, 999, "2.0.0", request));
    }

    @Test
    void create_configuration_for_version_succeeds_when_the_version_does_not_exist() throws Exception {
        configurationExists();

        store.createConfigurationForVersion(DOMAIN, CONTROL_ID, CONFIGURATION_ID, "2.0.0",
                new CreateControlConfiguration("{\"setting\": \"b\"}"));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configVersions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("namespace", String.class), is(CONFIG_NAMESPACE));
        assertThat(versionCaptor.getValue().get("version", String.class), is("2.0.0"));
    }

    @Test
    void create_configuration_for_version_throws_when_the_version_already_exists() {
        configurationExists();
        stubFind(configVersions, List.of(Document.createDocument().put("version", "1.0.0")));

        assertThrows(ControlConfigurationVersionExistsException.class, () ->
                store.createConfigurationForVersion(DOMAIN, CONTROL_ID, CONFIGURATION_ID, "1.0.0",
                        new CreateControlConfiguration("{}")));
    }

    @Test
    void create_configuration_for_version_never_syncs_name_or_description_onto_the_header() throws Exception {
        // Unlike a requirement version write, a configuration version write never syncs a
        // name/description onto its header — preserved unchanged from the old shape. The only
        // header write is the versionCount increment every version write makes.
        configurationExists();

        store.createConfigurationForVersion(DOMAIN, CONTROL_ID, CONFIGURATION_ID, "2.0.0",
                new CreateControlConfiguration("{}"));

        verify(configHeaders, times(1)).update(any(Filter.class), any(Document.class));
    }
}
