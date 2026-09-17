package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.controls.ControlConfigDetail;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionExistsException;
import org.finos.calm.domain.exception.ControlConfigurationVersionNotFoundException;
import org.finos.calm.domain.exception.ControlHasConfigurationsException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionExistsException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;
import java.util.function.Consumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Store-level tests for Control's header/version shape (ADR 0007). Document mechanics shared
 * with every other type are covered by {@code TestMongoVersionDocumentStoreShould}; what this
 * class pins is Control-specific glue: two composed stores (requirement, configuration), the
 * synthetic {@code domain::controlId} configuration namespace, which domain exception each
 * missing thing produces, and that only a requirement version write syncs the wrapper
 * name/description — a configuration version write never has.
 */
@QuarkusTest
public class TestMongoControlStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoDomainStore domainStore;

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoCollection<Document> controlHeaders;
    private MongoCollection<Document> controlVersions;
    private MongoCollection<Document> configHeaders;
    private MongoCollection<Document> configVersions;
    private MongoControlStore store;

    private static final String DOMAIN = "security";
    private static final int CONTROL_ID = 1;
    private static final int CONFIGURATION_ID = 10;
    private static final String CONFIG_NAMESPACE = DOMAIN + "::" + CONTROL_ID;

    @BeforeEach
    void setup() {
        controlHeaders = Mockito.mock(DocumentMongoCollection.class);
        controlVersions = Mockito.mock(DocumentMongoCollection.class);
        configHeaders = Mockito.mock(DocumentMongoCollection.class);
        configVersions = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("controls")).thenReturn(controlHeaders);
        when(mongoDatabase.getCollection("controlVersions")).thenReturn(controlVersions);
        when(mongoDatabase.getCollection("controlConfigurations")).thenReturn(configHeaders);
        when(mongoDatabase.getCollection("controlConfigurationVersions")).thenReturn(configVersions);
        when(domainStore.getDomains()).thenReturn(List.of(DOMAIN));

        store = new MongoControlStore(mongoDatabase, counterStore, domainStore);
    }

    private FindIterable<Document> stubFind(MongoCollection<Document> collection, List<Document> documents) {
        FindIterable<Document> iterable = Mockito.mock(DocumentFindIterable.class);
        when(collection.find(any(Bson.class))).thenReturn(iterable);
        when(iterable.projection(any())).thenReturn(iterable);
        when(iterable.sort(any())).thenReturn(iterable);
        when(iterable.skip(anyInt())).thenReturn(iterable);
        when(iterable.limit(anyInt())).thenReturn(iterable);
        when(iterable.first()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            documents.forEach(consumer);
            return null;
        }).when(iterable).forEach(any());
        return iterable;
    }

    private void controlExists() {
        stubFind(controlHeaders, List.of(new Document("controlId", CONTROL_ID)));
        stubFind(controlVersions, List.of());
        when(controlHeaders.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
    }

    private void controlDoesNotExist() {
        stubFind(controlHeaders, List.of());
    }

    private void configurationExists() {
        controlExists();
        stubFind(configHeaders, List.of(new Document("configurationId", CONFIGURATION_ID)));
        stubFind(configVersions, List.of());
        when(configHeaders.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
    }

    private void configurationDoesNotExist() {
        controlExists();
        stubFind(configHeaders, List.of());
    }

    private static MongoWriteException writeError(int code, String message) {
        return new MongoWriteException(new WriteError(code, message, new BsonDocument()), new ServerAddress(), List.of());
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
                new Document("controlId", 1).append("name", "Access Control").append("description", "Manage user access"),
                new Document("controlId", 2).append("name", "Encryption").append("description", "Data encryption requirements")));
        stubFind(controlVersions, List.of(new Document("version", "1.0.0").append("content", new Document("title", "Access Title"))));

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
        when(controlHeaders.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        CreateControlRequirement request = new CreateControlRequirement("New Control", "New Description", "{\"type\": \"control\"}");
        ControlDetail result = store.createControlRequirement(request, DOMAIN);

        assertThat(result.getId(), is(5));
        assertThat(result.getName(), is("New Control"));
        assertThat(result.getDescription(), is("New Description"));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlHeaders).insertOne(headerCaptor.capture());
        assertThat(headerCaptor.getValue().getInteger("controlId"), is(5));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlVersions).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.0"));
    }

    @Test
    void remove_the_header_again_when_the_first_requirement_version_write_fails() {
        when(counterStore.getNextControlSequenceValue()).thenReturn(5);
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(controlVersions).insertOne(any(Document.class));

        CreateControlRequirement request = new CreateControlRequirement("Test Control", "Test Description", "{}");
        assertThrows(StorageWriteException.class, () -> store.createControlRequirement(request, DOMAIN));

        verify(controlHeaders).deleteOne(any(Bson.class));
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
        stubFind(controlHeaders, List.of(new Document("controlId", CONTROL_ID)));
        stubFind(controlVersions, List.of(new Document("version", "1.0.0")));

        assertThat(store.getRequirementVersions(DOMAIN, CONTROL_ID), contains("1.0.0"));
    }

    // --- getRequirementForVersion ---

    @Test
    void get_requirement_for_version_returns_json() throws Exception {
        stubFind(controlHeaders, List.of(new Document("controlId", CONTROL_ID)));
        stubFind(controlVersions, List.of(new Document("content", new Document("type", "requirement"))));

        assertThat(store.getRequirementForVersion(DOMAIN, CONTROL_ID, "1.0.0"), containsString("requirement"));
    }

    @Test
    void get_requirement_for_version_throws_when_version_not_found() {
        stubFind(controlHeaders, List.of(new Document("controlId", CONTROL_ID)));
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
        verify(controlVersions).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("version"), is("2.0.0"));
    }

    @Test
    void create_requirement_for_version_throws_when_the_version_already_exists() {
        controlExists();
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(controlVersions).insertOne(any(Document.class));

        assertThrows(ControlRequirementVersionExistsException.class, () ->
                store.createRequirementForVersion(DOMAIN, CONTROL_ID, "1.0.0", new CreateControlRequirement("n", "d", "{}")));
    }

    @Test
    void create_requirement_for_version_reports_capacity_exceeded_on_document_size_limit() {
        controlExists();
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(controlVersions).insertOne(any(Document.class));

        StorageWriteException exception = assertThrows(StorageWriteException.class, () ->
                store.createRequirementForVersion(DOMAIN, CONTROL_ID, "2.0.0", new CreateControlRequirement("n", "d", "{}")));
        assertThat(exception.isCapacityExceeded(), is(true));
    }

    @Test
    void create_requirement_for_version_updates_wrapper_name_and_description_from_the_envelope() throws Exception {
        controlExists();

        store.createRequirementForVersion(DOMAIN, CONTROL_ID, "2.0.0",
                new CreateControlRequirement("New Name", "New Desc", "{\"type\":\"req-v2\"}"));

        // Two header writes: the versionCount increment (inside createVersion) and the
        // name/description update (updatePresentHeaderDetails).
        ArgumentCaptor<Bson> headerUpdateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(controlHeaders, Mockito.times(2)).updateOne(any(Bson.class), headerUpdateCaptor.capture());
        String detailsUpdate = headerUpdateCaptor.getAllValues().get(1).toBsonDocument().toJson();
        assertThat(detailsUpdate, containsString("New Name"));
        assertThat(detailsUpdate, containsString("New Desc"));
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
        verify(controlHeaders, Mockito.times(1)).updateOne(any(Bson.class), any(Bson.class));
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
                new Document("configurationId", 10), new Document("configurationId", 20)));

        assertThat(store.getConfigurationsForControl(DOMAIN, CONTROL_ID), contains(10, 20));
    }

    // --- getConfigurationDetailsForControl ---

    @Test
    void get_configuration_details_returns_id_name_and_title_for_each_config() throws Exception {
        controlExists();
        stubFind(configHeaders, List.of(new Document("configurationId", 10).append("name", "encryption-config")));
        stubFind(configVersions, List.of(new Document("version", "1.0.0").append("content", new Document("title", "Encryption Title"))));

        List<ControlConfigDetail> details = store.getConfigurationDetailsForControl(DOMAIN, CONTROL_ID);

        assertThat(details, hasSize(1));
        assertThat(details.get(0).getId(), is(10));
        assertThat(details.get(0).getName(), is("encryption-config"));
        assertThat(details.get(0).getTitle(), is("Encryption Title"));
    }

    @Test
    void get_configuration_details_synthesizes_a_name_for_configs_without_one() throws Exception {
        // MongoVersionDocumentStore#toSummary synthesizes "<Label> <id>" for a header with no
        // stored name — the same fallback every other migrated type gets from the shared
        // helper (unlike the old shape, which returned a genuine null here).
        controlExists();
        stubFind(configHeaders, List.of(new Document("configurationId", 10)));
        stubFind(configVersions, List.of());

        List<ControlConfigDetail> details = store.getConfigurationDetailsForControl(DOMAIN, CONTROL_ID);

        assertThat(details.get(0).getName(), is("Configuration 10"));
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
        when(configHeaders.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        CreateControlConfiguration request = new CreateControlConfiguration("{\"setting\": \"enabled\"}");
        int configId = store.createControlConfiguration(request, DOMAIN, CONTROL_ID);

        assertThat(configId, is(42));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configHeaders).insertOne(headerCaptor.capture());
        assertThat(headerCaptor.getValue().getInteger("configurationId"), is(42));
        assertThat(headerCaptor.getValue().getString("namespace"), is(CONFIG_NAMESPACE));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configVersions).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("namespace"), is(CONFIG_NAMESPACE));
    }

    @Test
    void create_control_configuration_with_a_name_stores_it_on_the_header() throws Exception {
        controlExists();
        when(counterStore.getNextControlConfigurationSequenceValue()).thenReturn(55);
        when(configHeaders.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        CreateControlConfiguration request = new CreateControlConfiguration("tls-config", "{\"cipher\":\"AES\"}");
        store.createControlConfiguration(request, DOMAIN, CONTROL_ID);

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configHeaders).insertOne(headerCaptor.capture());
        assertThat(headerCaptor.getValue().getString("name"), is("tls-config"));
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
        stubFind(configHeaders, List.of(new Document("configurationId", CONFIGURATION_ID)));
        stubFind(configVersions, List.of(
                new Document("version", "2.0.0"), new Document("version", "1.0.0")));

        assertThat(store.getConfigurationVersions(DOMAIN, CONTROL_ID, CONFIGURATION_ID), contains("1.0.0", "2.0.0"));
    }

    // --- getConfigurationForVersion ---

    @Test
    void get_configuration_for_version_returns_json() throws Exception {
        configurationExists();
        stubFind(configVersions, List.of(new Document("content", new Document("setting", "versioned"))));

        assertThat(store.getConfigurationForVersion(DOMAIN, CONTROL_ID, CONFIGURATION_ID, "1.0.0"),
                containsString("versioned"));
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
        verify(configVersions).insertOne(versionCaptor.capture());
        assertThat(versionCaptor.getValue().getString("namespace"), is(CONFIG_NAMESPACE));
        assertThat(versionCaptor.getValue().getString("version"), is("2.0.0"));
    }

    @Test
    void create_configuration_for_version_throws_when_the_version_already_exists() {
        configurationExists();
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(configVersions).insertOne(any(Document.class));

        assertThrows(ControlConfigurationVersionExistsException.class, () ->
                store.createConfigurationForVersion(DOMAIN, CONTROL_ID, CONFIGURATION_ID, "1.0.0",
                        new CreateControlConfiguration("{}")));
    }

    @Test
    void create_configuration_for_version_reports_capacity_exceeded_on_document_size_limit() {
        configurationExists();
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(configVersions).insertOne(any(Document.class));

        StorageWriteException exception = assertThrows(StorageWriteException.class, () ->
                store.createConfigurationForVersion(DOMAIN, CONTROL_ID, CONFIGURATION_ID, "2.0.0",
                        new CreateControlConfiguration("{}")));
        assertThat(exception.isCapacityExceeded(), is(true));
    }

    @Test
    void create_configuration_for_version_never_syncs_name_or_description_onto_the_header() throws Exception {
        // Unlike a requirement version write, a configuration version write never syncs a
        // name/description onto its header — that behavior is preserved unchanged from the
        // old shape. The only header write is the versionCount increment every version write
        // makes (see MongoVersionDocumentStore#incrementVersionCount).
        configurationExists();

        store.createConfigurationForVersion(DOMAIN, CONTROL_ID, CONFIGURATION_ID, "2.0.0",
                new CreateControlConfiguration("{}"));

        verify(configHeaders, Mockito.times(1)).updateOne(any(Bson.class), any(Bson.class));
    }

    // --- deleteControlRequirement ---

    @Test
    void throw_a_domain_exception_when_deleting_a_control_requirement_in_a_missing_domain() {
        assertThrows(DomainNotFoundException.class, () -> store.deleteControlRequirement("invalid", CONTROL_ID));
    }

    @Test
    void throw_a_control_exception_when_deleting_a_missing_control_requirement() {
        controlDoesNotExist();

        assertThrows(ControlNotFoundException.class, () -> store.deleteControlRequirement(DOMAIN, CONTROL_ID));
    }

    @Test
    void refuse_to_delete_a_control_requirement_that_still_has_configurations() {
        controlExists();
        when(configHeaders.countDocuments(any(Bson.class))).thenReturn(2L);

        ControlHasConfigurationsException exception = assertThrows(ControlHasConfigurationsException.class,
                () -> store.deleteControlRequirement(DOMAIN, CONTROL_ID));
        assertThat(exception.getControlId(), is(CONTROL_ID));
        assertThat(exception.getConfigurationCount(), is(2));
        verify(controlHeaders, never()).deleteOne(any(Bson.class));
    }

    @Test
    void delete_the_requirement_header_and_all_versions_when_it_has_no_configurations() throws Exception {
        controlExists();
        when(configHeaders.countDocuments(any(Bson.class))).thenReturn(0L);
        when(controlHeaders.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(1));

        store.deleteControlRequirement(DOMAIN, CONTROL_ID);

        verify(controlVersions).deleteMany(any(Bson.class));
        verify(controlHeaders).deleteOne(any(Bson.class));
    }

    // --- deleteControlConfiguration ---

    @Test
    void throw_a_domain_exception_when_deleting_a_configuration_in_a_missing_domain() {
        assertThrows(DomainNotFoundException.class,
                () -> store.deleteControlConfiguration("invalid", CONTROL_ID, CONFIGURATION_ID));
    }

    @Test
    void throw_a_control_exception_when_deleting_a_configuration_for_a_missing_control() {
        controlDoesNotExist();

        assertThrows(ControlNotFoundException.class,
                () -> store.deleteControlConfiguration(DOMAIN, CONTROL_ID, CONFIGURATION_ID));
    }

    @Test
    void throw_a_configuration_exception_when_deleting_a_missing_configuration() {
        controlExists();
        stubFind(configHeaders, List.of());

        assertThrows(ControlConfigurationNotFoundException.class,
                () -> store.deleteControlConfiguration(DOMAIN, CONTROL_ID, CONFIGURATION_ID));
    }

    @Test
    void delete_the_configuration_header_and_all_versions_when_it_exists() throws Exception {
        configurationExists();
        when(configHeaders.deleteOne(any(Bson.class))).thenReturn(DeleteResult.acknowledged(1));

        store.deleteControlConfiguration(DOMAIN, CONTROL_ID, CONFIGURATION_ID);

        verify(configVersions).deleteMany(any(Bson.class));
        verify(configHeaders).deleteOne(any(Bson.class));
    }
}
