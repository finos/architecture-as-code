package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.standards.NamespaceStandardSummary;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.*;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestMongoStandardStoreShould {

    @InjectMock
    MongoClient mongoClient;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> standardCollection;

    private MongoStandardStore mongoStandardStore;

    @BeforeEach
    void setup() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
        standardCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("standards")).thenReturn(standardCollection);
        mongoStandardStore = new MongoStandardStore(mongoClient, counterStore, namespaceStore);
    }

    @Test
    void get_standard_for_namespace_that_doesnt_exist_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoStandardStore.getStandardsForNamespace(namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void get_standard_for_namespace_returns_empty_list_when_none_exist() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(standardCollection.find(eq(Filters.eq("namespace", "finos"))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);
        when(documentMock.getList("standards", Document.class))
                .thenReturn(new ArrayList<>());

        assertThat(mongoStandardStore.getStandardsForNamespace("finos"), is(empty()));
        verify(namespaceStore).namespaceExists("finos");
    }

    @Test
    void get_standard_for_namespace_returns_empty_list_when_mongo_collection_not_created() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(standardCollection.find(eq(Filters.eq("namespace", "finos"))))
                .thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoStandardStore.getStandardsForNamespace("finos"), is(empty()));
        verify(namespaceStore).namespaceExists("finos");
    }

    @Test
    void get_standard_for_namespace_returns_values() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(standardCollection.find(eq(Filters.eq("namespace", "finos"))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        Map<String, Object> standardDetailMap = new HashMap<>();
        standardDetailMap.put("standardId", 55);
        standardDetailMap.put("name", "Test Standard");
        standardDetailMap.put("description", "Test Description");

        Document doc = new Document(standardDetailMap);

        when(documentMock.getList("standards", Document.class))
                .thenReturn(List.of(doc));

        List<NamespaceStandardSummary> standards = mongoStandardStore.getStandardsForNamespace("finos");

        assertThat(standards.size(), is(1));
        assertThat(standards.getFirst().getName(), is("Test Standard"));
        assertThat(standards.getFirst().getDescription(), is("Test Description"));
        assertThat(standards.getFirst().getId(), is(55));

        verify(namespaceStore).namespaceExists("finos");
    }

    @Test
    void return_a_namespace_exception_when_namespace_does_not_exist_when_creating_standard() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";
        CreateStandardRequest createStandardRequest = new CreateStandardRequest();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoStandardStore.createStandardForNamespace(createStandardRequest, namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_a_json_parse_exception_when_an_invalid_json_object_is_presented_when_creating_standard() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextStandardSequenceValue()).thenReturn(42);

        CreateStandardRequest createStandardRequest = new CreateStandardRequest();
        createStandardRequest.setStandardJson("invalid JSON");

        assertThrows(JsonParseException.class,
                () -> mongoStandardStore.createStandardForNamespace(createStandardRequest, "finos"));
    }

    @Test
    void return_created_standard_when_parameters_are_valid() throws NamespaceNotFoundException {
        String validNamespace = "finos";
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextStandardSequenceValue()).thenReturn(sequenceNumber);

        CreateStandardRequest standardToCreate = new CreateStandardRequest(
                "test",
                "Test Standard",
                "{}"
        );

        standardToCreate.setStandardJson("{}");
        standardToCreate.setDescription("Test Standard");
        standardToCreate.setName("test");

        Standard createdStandard = mongoStandardStore.createStandardForNamespace(standardToCreate, validNamespace);

        //Update the id from the standard
        Standard standard = new Standard(standardToCreate);
        standard.setVersion("1.0.0");
        standard.setId(sequenceNumber);

        assertThat(createdStandard, is(standard));

        Document expectedDoc = new Document("standardId", sequenceNumber)
                .append("name", standardToCreate.getName())
                .append("description", standardToCreate.getDescription())
                .append("versions", new Document("1-0-0", Document.parse(standardToCreate.getStandardJson())));

        verify(standardCollection).updateOne(
                eq(Filters.eq("namespace", validNamespace)),
                eq(Updates.push("standards", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void get_standard_versions_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoStandardStore.getStandardVersions("does-not-exist", 5));

        verify(namespaceStore).namespaceExists("does-not-exist");
    }

    private FindIterable<Document> setupInvalidStandard() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        //Return the same find iterable as the projection unboxes, then return null
        when(standardCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);


        return findIterable;
    }

    @Test
    void get_standard_versions_for_invalid_standard_throws_exception() {
        FindIterable<Document> findIterable = setupInvalidStandard();

        assertThrows(StandardNotFoundException.class,
                () -> mongoStandardStore.getStandardVersions("finos", 5));

        verify(standardCollection).find(new Document("namespace", "finos"));
        verify(findIterable).projection(Projections.fields(Projections.include("standards")));
    }

    @Test
    void get_standard_versions_for_standard_returns_list_of_versions() throws StandardNotFoundException, NamespaceNotFoundException {
        mockSetupStandardDocumentWithVersions();

        List<String> standardVersions = mongoStandardStore.getStandardVersions("finos", 42);

        assertThat(standardVersions, is(List.of("1.0.0")));
    }

    @Test
    void throw_an_exception_for_an_invalid_namespace_when_retrieving_standard_for_version() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String invalidNamespace = "does-not-exist";

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoStandardStore.getStandardForVersion(invalidNamespace, null, null));

        verify(namespaceStore).namespaceExists(invalidNamespace);
    }

    @Test
    void throw_an_exception_for_an_invalid_standard_when_retrieving_standard_for_version() {
        FindIterable<Document> findIterable = setupInvalidStandard();
        String validNamespace = "finos";

        assertThrows(StandardNotFoundException.class,
                () -> mongoStandardStore.getStandardForVersion(validNamespace, 1, null));

        verify(standardCollection).find(new Document("namespace", validNamespace));
        verify(findIterable).projection(Projections.fields(Projections.include("standards")));
    }

    @Test
    void return_a_standard_for_a_given_version() throws StandardNotFoundException, StandardVersionNotFoundException, NamespaceNotFoundException {
        mockSetupStandardDocumentWithVersions();

        String standardForVersion = mongoStandardStore.getStandardForVersion("finos", 42, "1.0.0");
        assertThat(standardForVersion, is("{}"));
    }


    private Document setupStandardVersionDocument() {
        //Set up a standard document with 2 standards in (one with a valid version)
        Map<String, Document> versionMap = new HashMap<>();
        versionMap.put("1-0-0", Document.parse("{}"));
        Document targetStoredStandard = new Document("standardId", 42)
                .append("versions", new Document(versionMap));

        Document paddingStandard = new Document("standardId", 0);

        return new Document("namespace", "finos")
                .append("standards", Arrays.asList(paddingStandard, targetStoredStandard));
    }

    private void mockSetupStandardDocumentWithVersions() {
        Document mainDocument = setupStandardVersionDocument();
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(standardCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    @Test
    void throw_an_exception_when_standard_for_given_version_does_not_exist() {
        mockSetupStandardDocumentWithVersions();

        assertThrows(StandardVersionNotFoundException.class,
                () -> mongoStandardStore.getStandardForVersion("finos", 42, "9.0.0"));
    }

    @Test
    void throw_an_exception_for_create_standard_for_version_when_a_namespace_doesnt_exist() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> mongoStandardStore.createStandardForVersion(standardToStore(), "finos", 42, "9.0.0"));
    }

    @Test
    void throw_an_exception_for_create_standard_for_version_when_a_standard_doesnt_exist() {
        mockSetupStandardDocumentWithVersions();
        CreateStandardRequest standard = standardToStore();

        WriteError writeError = new WriteError(2, "The positional operator did not find the match needed from the query", new BsonDocument());
        MongoWriteException mongoWriteException = new MongoWriteException(writeError, new ServerAddress());
        when(standardCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class))).thenThrow(mongoWriteException);

        assertThrows(StandardNotFoundException.class, () -> mongoStandardStore.createStandardForVersion(standard, "finos", 50, "1.0.1"));
    }

    @Test
    void throw_an_exception_for_create_standard_for_version_when_a_version_already_exists() {
        mockSetupStandardDocumentWithVersions();
        CreateStandardRequest standard = standardToStore();

        assertThrows(StandardVersionExistsException.class, () -> mongoStandardStore.createStandardForVersion(standard, "finos", 42, "1.0.0"));
    }

    @Test
    void accept_the_creation_of_a_valid_version() throws StandardVersionExistsException, StandardNotFoundException, NamespaceNotFoundException {
        mockSetupStandardDocumentWithVersions();
        CreateStandardRequest standard = standardToStore();
        mongoStandardStore.createStandardForVersion(standard, "finos", 42, "1.0.1");

        verify(standardCollection).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    private CreateStandardRequest standardToStore() {
        return new CreateStandardRequest("Second Version", "Second Description", "{}");
    }
}
