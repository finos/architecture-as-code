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
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.patterns.CreatePatternRequest;
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
public class TestMongoPatternStoreShould {

    @InjectMock
    MongoClient mongoClient;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private MongoCollection patternCollection;

    private MongoPatternStore mongoPatternStore;

    private final String validJson = "{\"test\": \"test\"}";

    @BeforeEach
    void setup() {
        MongoDatabase mongoDatabase = Mockito.mock(MongoDatabase.class);
        patternCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("patterns")).thenReturn(patternCollection);
        mongoPatternStore = new MongoPatternStore(mongoClient, counterStore, namespaceStore);
    }

    @Test
    void get_pattern_for_namespace_that_doesnt_exist_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.getPatternsForNamespace(namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void get_pattern_for_namespace_returns_empty_list_when_none_exist() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(patternCollection.find(eq(Filters.eq("namespace", "finos"))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);
        when(documentMock.getList("patterns", Document.class))
                .thenReturn(new ArrayList<>());

        assertThat(mongoPatternStore.getPatternsForNamespace("finos"), is(empty()));
        verify(namespaceStore).namespaceExists("finos");
    }

    @Test
    void get_pattern_for_namespace_returns_empty_list_when_mongo_collection_not_created() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(patternCollection.find(eq(Filters.eq("namespace", "finos"))))
                .thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoPatternStore.getPatternsForNamespace("finos"), is(empty()));
        verify(namespaceStore).namespaceExists("finos");
    }

    @Test
    void get_pattern_for_namespace_returns_values() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(patternCollection.find(eq(Filters.eq("namespace", "finos"))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        Document doc1 = new Document("patternId", 1001);
        Document doc2 = new Document("patternId", 1002);

        when(documentMock.getList("patterns", Document.class))
                .thenReturn(Arrays.asList(doc1, doc2));

        List<Integer> patternIds = mongoPatternStore.getPatternsForNamespace("finos");

        assertThat(patternIds, is(Arrays.asList(1001, 1002)));
        verify(namespaceStore).namespaceExists("finos");
    }

    @Test
    void return_a_namespace_exception_when_namespace_does_not_exist() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";
        CreatePatternRequest createPatternRequest = new CreatePatternRequest();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.createPatternForNamespace(createPatternRequest, namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_a_json_parse_exception_when_an_invalid_json_object_is_presented() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextPatternSequenceValue()).thenReturn(42);

        CreatePatternRequest createPatternRequest = new CreatePatternRequest();
        createPatternRequest.setPatternJson("Invalid JSON");

        assertThrows(JsonParseException.class,
                () -> mongoPatternStore.createPatternForNamespace(createPatternRequest, "finos"));
    }

    @Test
    void return_created_pattern_when_parameters_are_valid() throws NamespaceNotFoundException {
        String validNamespace = "finos";
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextPatternSequenceValue()).thenReturn(sequenceNumber);

        CreatePatternRequest patternToCreate = new CreatePatternRequest(
                "test",
                "Test Pattern",
                "{}"
        );
        patternToCreate.setPatternJson("{}");
        patternToCreate.setDescription("Test Pattern");
        patternToCreate.setName("test");

        Pattern pattern = mongoPatternStore.createPatternForNamespace(patternToCreate, validNamespace);

        Pattern expectedPattern = new Pattern(patternToCreate);
                expectedPattern.setVersion("1.0.0");
                expectedPattern.setId(sequenceNumber);

        assertThat(pattern, is(expectedPattern));
        Document expectedDoc = new Document("patternId", sequenceNumber)
                .append("name", patternToCreate.getName())
                .append("description", patternToCreate.getDescription())
                .append("versions", new Document("1-0-0", Document.parse(patternToCreate.getPatternJson())));

        verify(patternCollection).updateOne(
                eq(Filters.eq("namespace", validNamespace)),
                eq(Updates.push("patterns", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void get_pattern_version_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.getPatternVersions("does-not-exist", 12));

        verify(namespaceStore).namespaceExists("does-not-exist");
    }

    private FindIterable<Document> setupInvalidPattern() {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        //Return the same find iterable as the projection unboxes, then return null
        when(patternCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);


        return findIterable;
    }

    @Test
    void get_pattern_version_for_invalid_pattern_throws_exception() {
        FindIterable<Document> findIterable = setupInvalidPattern();

        assertThrows(PatternNotFoundException.class,
                () -> mongoPatternStore.getPatternVersions("finos"));

        verify(patternCollection).find(new Document("namespace", "finos"));
        verify(findIterable).projection(Projections.fields(Projections.include("patterns")));
    }

    @Test
    void get_pattern_versions_for_valid_pattern_returns_list_of_versions() throws PatternNotFoundException, NamespaceNotFoundException {
        mockSetupPatternDocumentWithVersions();

        List<String> patternVersions = mongoPatternStore.getPatternVersions("finos", 42);

        assertThat(patternVersions, is(List.of("1.0.0")));
    }

    @Test
    void throw_an_exception_for_an_invalid_namespace_when_retrieving_pattern_for_version() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String invalidNamespace = "does-not-exist");

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.getPatternForVersion(invalidNamespace, null, null));

        verify(namespaceStore).namespaceExists(invalidNamespace);
    }

    @Test
    void throw_an_exception_for_an_invalid_pattern_when_retrieving_pattern_for_version() {
        FindIterable<Document> findIterable = setupInvalidPattern();
        String validNamespace = "finos";

        assertThrows(PatternNotFoundException.class,
                () -> mongoPatternStore.getPatternForVersion(validNamespace, 1, null));

        verify(patternCollection).find(new Document("namespace", validNamespace));
        verify(findIterable).projection(Projections.fields(Projections.include("patterns")));
    }

    @Test
    void return_a_pattern_for_a_given_version() throws PatternNotFoundException, PatternVersionNotFoundException, NamespaceNotFoundException {
        mockSetupPatternDocumentWithVersions();

        Pattern patternForVersion = mongoPatternStore.getPatternForVersion("finos", 42, "1.0.0");
        assertThat(patternForVersion, is("{}"));
    }


    private Document setupPatternVersionDocument() {
        //Set up a patterns document with 2 patterns in (one with a valid version)
        Map<String, Document> versionMap = new HashMap<>();
        versionMap.put("1-0-0", Document.parse("{}"));
        Document targetStoredPattern = new Document("patternId", 42)
                .append("versions", new Document(versionMap));

        Document paddingPattern = new Document("patternId", 0);

        return new Document("namespace", "finos")
                .append("patterns", Arrays.asList(paddingPattern, targetStoredPattern));
    }

    private void mockSetupPatternDocumentWithVersions() {
        Document mainDocument = setupPatternVersionDocument();
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(patternCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    @Test
    void throw_an_exception_when_pattern_for_given_version_does_not_exist() {
        mockSetupPatternDocumentWithVersions();

        assertThrows(PatternVersionNotFoundException.class,
                () -> mongoPatternStore.getPatternForVersion("finos", 42, "9.0.0"));
    }

    @Test
    void throw_an_exception_when_create_or_update_pattern_for_version_with_a_namespace_that_doesnt_exists() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.createPatternForVersion("finos", 42, "9.0.0"));
        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.updatePatternForVersion("finos", 42, "9.0.0"));

        verify(namespaceStore, times(2)).namespaceExists("finos");
    }

    @Test
    void throw_an_exception_when_create_on_a_version_that_exists() {
        mockSetupPatternDocumentWithVersions();

        CreatePatternRequest pattern = patternToStore();

        assertThrows(PatternVersionExistsException.class,
                () -> mongoPatternStore.createPatternForVersion(pattern, "finos", 42, "1.0.0"));
    }

    @Test
    void throw_a_pattern_not_found_exception_when_creating_or_updating_a_version() {
        mockSetupPatternDocumentWithVersions();

        CreatePatternRequest pattern = patternToStore();

        WriteError writeError = new WriteError(2, "The positional operator did not find the match needed from the query", new BsonDocument());
        MongoWriteException mongoWriteException = new MongoWriteException(writeError, new ServerAddress());

        when(patternCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(mongoWriteException);

        assertThrows(PatternNotFoundException.class,
                () -> mongoPatternStore.createPatternForVersion(pattern, "finos", 50, "1.0.1"));
        assertThrows(PatternNotFoundException.class,
                () -> mongoPatternStore.updatePatternForVersion(pattern, "finos", 50, "1.0.1"));
    }

    @Test
    void accept_the_creation_or_update_of_a_valid_version() throws PatternNotFoundException, NamespaceNotFoundException, PatternVersionExistsException {
        mockSetupPatternDocumentWithVersions();

        CreatePatternRequest pattern = patternToStore();

        mongoPatternStore.updatePatternForVersion(pattern, "finos", 42, "1.0.1");
        mongoPatternStore.createPatternForVersion(pattern, "finos", 42, "1.0.1");

        verify(patternCollection, times(2)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    private CreatePatternRequest patternToStore() {
        return new CreatePatternRequest("Fake Version", "Fake Description", "{}")
    }
}
