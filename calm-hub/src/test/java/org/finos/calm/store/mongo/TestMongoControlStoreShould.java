package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.UpdateOptions;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionNotFoundException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
public class TestMongoControlStoreShould {
    
    @InjectMock
    MongoDatabase mongoDatabase;
    
    @InjectMock
    MongoCounterStore mongoCounterStore;
    
    @InjectMock
    MongoDomainStore mongoDomainStore;

    private MongoCollection<Document> controlCollection;
    private MongoControlStore mongoControlStore;

    @BeforeEach
    @SuppressWarnings("unchecked")
    public void setup() {
        controlCollection = Mockito.mock(MongoCollection.class);

        when(mongoDatabase.getCollection("controls")).thenReturn(controlCollection);
        mongoControlStore = new MongoControlStore(mongoDatabase, mongoCounterStore, mongoDomainStore);
    }

    @SuppressWarnings("unchecked")
    private FindIterable<Document> mockFindIterable() {
        return Mockito.mock(FindIterable.class);
    }

    // --- getControlsForDomain ---

    @Test
    void get_controls_for_domain_returns_empty_list_when_domain_has_no_controls() throws DomainNotFoundException {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));
        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        List<ControlDetail> result = mongoControlStore.getControlsForDomain("security");

        assertThat(result, is(empty()));
    }

    @Test
    void get_controls_for_domain_throws_exception_when_domain_does_not_exist() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        assertThrows(DomainNotFoundException.class, () -> {
            mongoControlStore.getControlsForDomain("invalid-domain");
        });
    }

    @Test
    void get_controls_for_domain_returns_list_of_controls_when_domain_exists() throws DomainNotFoundException {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));
        
        Document control1 = new Document("controlId", 1)
                .append("name", "Access Control")
                .append("description", "Manage user access");
        
        Document control2 = new Document("controlId", 2)
                .append("name", "Encryption")
                .append("description", "Data encryption requirements");

        Document domainDoc = new Document("domain", "security")
                .append("controls", Arrays.asList(control1, control2));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        List<ControlDetail> result = mongoControlStore.getControlsForDomain("security");

        assertThat(result, hasSize(2));
        assertThat(result.get(0).getId(), is(1));
        assertThat(result.get(0).getName(), is("Access Control"));
        assertThat(result.get(0).getDescription(), is("Manage user access"));
        assertThat(result.get(1).getId(), is(2));
        assertThat(result.get(1).getName(), is("Encryption"));
        assertThat(result.get(1).getDescription(), is("Data encryption requirements"));
    }

    // --- createControlRequirement ---

    @Test
    void create_control_requirement_throws_exception_when_domain_does_not_exist() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));
        CreateControlRequirement createRequest = new CreateControlRequirement("Test Control", "Test Description", "{}");

        assertThrows(DomainNotFoundException.class, () -> {
            mongoControlStore.createControlRequirement(createRequest, "invalid-domain");
        });
    }

    @Test
    void create_control_requirement_creates_control_when_domain_exists() throws DomainNotFoundException {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));
        when(mongoCounterStore.getNextControlSequenceValue()).thenReturn(5);
        
        CreateControlRequirement createRequest = new CreateControlRequirement("New Control", "New Description", "{\"type\": \"control\"}");

        ControlDetail result = mongoControlStore.createControlRequirement(createRequest, "security");

        assertThat(result.getId(), is(5));
        assertThat(result.getName(), is("New Control"));
        assertThat(result.getDescription(), is("New Description"));
        
        verify(controlCollection).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
        verify(mongoCounterStore).getNextControlSequenceValue();
    }

    @Test
    void create_control_requirement_stores_requirement_json() throws DomainNotFoundException {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));
        when(mongoCounterStore.getNextControlSequenceValue()).thenReturn(10);
        
        CreateControlRequirement createRequest = new CreateControlRequirement("JSON Control", "Control with JSON", "{\"requirement\": \"strict\"}");

        mongoControlStore.createControlRequirement(createRequest, "security");

        verify(controlCollection).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
        verify(mongoCounterStore).getNextControlSequenceValue();
    }

    // --- getRequirementVersions ---

    @Test
    void get_requirement_versions_returns_version_list() throws Exception {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document requirement = new Document("1-0-0", new Document("type", "req"));
        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Test Desc")
                .append("requirement", requirement)
                .append("configurations", new ArrayList<>());
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        List<String> versions = mongoControlStore.getRequirementVersions("security", 1);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), is("1.0.0"));
    }

    @Test
    void get_requirement_versions_throws_when_control_not_found() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document domainDoc = new Document("domain", "security")
                .append("controls", new ArrayList<>());

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        assertThrows(ControlNotFoundException.class, () ->
                mongoControlStore.getRequirementVersions("security", 999));
    }

    @Test
    void get_requirement_versions_throws_when_domain_not_found() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        assertThrows(DomainNotFoundException.class, () ->
                mongoControlStore.getRequirementVersions("invalid", 1));
    }

    // --- getRequirementForVersion ---

    @Test
    void get_requirement_for_version_returns_json() throws Exception {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document requirementContent = new Document("type", "requirement");
        Document requirement = new Document("1-0-0", requirementContent);
        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Test Desc")
                .append("requirement", requirement)
                .append("configurations", new ArrayList<>());
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        String json = mongoControlStore.getRequirementForVersion("security", 1, "1.0.0");

        assertThat(json, containsString("requirement"));
    }

    @Test
    void get_requirement_for_version_throws_when_version_not_found() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document requirement = new Document("1-0-0", new Document("type", "req"));
        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Test Desc")
                .append("requirement", requirement)
                .append("configurations", new ArrayList<>());
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        assertThrows(ControlRequirementVersionNotFoundException.class, () ->
                mongoControlStore.getRequirementForVersion("security", 1, "9.9.9"));
    }

    @Test
    void get_requirement_for_version_throws_when_control_not_found() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document domainDoc = new Document("domain", "security")
                .append("controls", new ArrayList<>());

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        assertThrows(ControlNotFoundException.class, () ->
                mongoControlStore.getRequirementForVersion("security", 999, "1.0.0"));
    }

    // --- getConfigurationsForControl ---

    @Test
    void get_configurations_returns_config_ids() throws Exception {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document config1 = new Document("configurationId", 10)
                .append("versions", new Document("1-0-0", new Document("setting", "a")));
        Document config2 = new Document("configurationId", 20)
                .append("versions", new Document("1-0-0", new Document("setting", "b")));

        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Desc")
                .append("requirement", new Document("1-0-0", new Document()))
                .append("configurations", List.of(config1, config2));
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        List<Integer> configIds = mongoControlStore.getConfigurationsForControl("security", 1);

        assertThat(configIds, hasSize(2));
        assertThat(configIds, contains(10, 20));
    }

    @Test
    void get_configurations_returns_empty_when_no_configurations_exist() throws Exception {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Desc")
                .append("requirement", new Document("1-0-0", new Document()))
                .append("configurations", new ArrayList<>());
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        List<Integer> configIds = mongoControlStore.getConfigurationsForControl("security", 1);

        assertThat(configIds, is(empty()));
    }

    @Test
    void get_configurations_throws_when_control_not_found() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document domainDoc = new Document("domain", "security")
                .append("controls", new ArrayList<>());

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        assertThrows(ControlNotFoundException.class, () ->
                mongoControlStore.getConfigurationsForControl("security", 999));
    }

    // --- getConfigurationVersions ---

    @Test
    void get_configuration_versions_returns_version_list() throws Exception {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document versions = new Document("1-0-0", new Document("a", "b"))
                .append("2-0-0", new Document("c", "d"));
        Document config = new Document("configurationId", 10)
                .append("versions", versions);

        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Desc")
                .append("requirement", new Document("1-0-0", new Document()))
                .append("configurations", List.of(config));
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        List<String> versionList = mongoControlStore.getConfigurationVersions("security", 1, 10);

        assertThat(versionList, hasSize(2));
        assertThat(versionList, contains("1.0.0", "2.0.0"));
    }

    @Test
    void get_configuration_versions_throws_when_config_not_found() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Desc")
                .append("requirement", new Document("1-0-0", new Document()))
                .append("configurations", new ArrayList<>());
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        assertThrows(ControlConfigurationNotFoundException.class, () ->
                mongoControlStore.getConfigurationVersions("security", 1, 999));
    }

    // --- getConfigurationForVersion ---

    @Test
    void get_configuration_for_version_returns_json() throws Exception {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document config = new Document("configurationId", 10)
                .append("versions", new Document("1-0-0", new Document("setting", "versioned")));

        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Desc")
                .append("requirement", new Document("1-0-0", new Document()))
                .append("configurations", List.of(config));
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        String json = mongoControlStore.getConfigurationForVersion("security", 1, 10, "1.0.0");

        assertThat(json, containsString("versioned"));
    }

    @Test
    void get_configuration_for_version_throws_when_version_not_found() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document config = new Document("configurationId", 10)
                .append("versions", new Document("1-0-0", new Document("a", "b")));

        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Desc")
                .append("requirement", new Document("1-0-0", new Document()))
                .append("configurations", List.of(config));
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        assertThrows(ControlConfigurationVersionNotFoundException.class, () ->
                mongoControlStore.getConfigurationForVersion("security", 1, 10, "9.9.9"));
    }

    @Test
    void get_configuration_for_version_throws_when_config_not_found() {
        when(mongoDomainStore.getDomains()).thenReturn(List.of("security"));

        Document controlDoc = new Document("controlId", 1)
                .append("name", "Test")
                .append("description", "Desc")
                .append("requirement", new Document("1-0-0", new Document()))
                .append("configurations", new ArrayList<>());
        Document domainDoc = new Document("domain", "security")
                .append("controls", List.of(controlDoc));

        FindIterable<Document> findIterable = mockFindIterable();
        when(controlCollection.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(domainDoc);

        assertThrows(ControlConfigurationNotFoundException.class, () ->
                mongoControlStore.getConfigurationForVersion("security", 1, 999, "1.0.0"));
    }
}