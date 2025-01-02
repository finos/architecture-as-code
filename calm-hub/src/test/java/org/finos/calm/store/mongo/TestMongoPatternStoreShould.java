package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.*;
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
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
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

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> patternCollection;

    private MongoPatternStore mongoPatternStore;

    private final String validJson = "{\"test\": \"test\"}";
    @BeforeEach
    void setup() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
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
        Pattern pattern = new Pattern.PatternBuilder().setNamespace(namespace).build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.createPatternForNamespace(pattern));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_a_json_parse_exception_when_an_invalid_json_object_is_presented() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextSequenceValue()).thenReturn(42);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos")
                .setPattern("Invalid JSON")
                .build();

        assertThrows(JsonParseException.class,
                () -> mongoPatternStore.createPatternForNamespace(pattern));
    }

    @Test
    void return_created_pattern_when_parameters_are_valid() throws NamespaceNotFoundException {
        String validNamespace = "finos";
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextSequenceValue()).thenReturn(sequenceNumber);
        Pattern patternToCreate = new Pattern.PatternBuilder().setPattern(validJson)
                .setNamespace(validNamespace)
                .build();

        Pattern pattern = mongoPatternStore.createPatternForNamespace(patternToCreate);

        Pattern expectedPattern = new Pattern.PatternBuilder().setPattern(validJson)
                .setNamespace(validNamespace)
                .setVersion("1.0.0")
                .setId(sequenceNumber)
                .build();

        assertThat(pattern, is(expectedPattern));
        Document expectedDoc = new Document("patternId", pattern.getId()).append("versions",
                new Document("1-0-0", Document.parse(pattern.getPatternJson())));

        verify(patternCollection).updateOne(
                eq(Filters.eq("namespace", validNamespace)),
                eq(Updates.push("patterns", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void get_pattern_version_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.getPatternVersions(pattern));

        verify(namespaceStore).namespaceExists(pattern.getNamespace());
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
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").build();

        assertThrows(PatternNotFoundException.class,
                () -> mongoPatternStore.getPatternVersions(pattern));

        verify(patternCollection).find(new Document("namespace", pattern.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("patterns")));
    }

    @Test
    void get_pattern_versions_for_valid_pattern_returns_list_of_versions() throws PatternNotFoundException, NamespaceNotFoundException {
        mockSetupPatternDocumentWithVersions();

        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(42).build();
        List<String> patternVersions = mongoPatternStore.getPatternVersions(pattern);

        assertThat(patternVersions, is(Arrays.asList("1.0.0")));
    }

    @Test
    void throw_an_exception_for_an_invalid_namespace_when_retrieving_pattern_for_version() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.getPatternForVersion(pattern));

        verify(namespaceStore).namespaceExists(pattern.getNamespace());
    }

    @Test
    void throw_an_exception_for_an_invalid_pattern_when_retrieving_pattern_for_version() {
        FindIterable<Document> findIterable = setupInvalidPattern();
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").build();

        assertThrows(PatternNotFoundException.class,
                () -> mongoPatternStore.getPatternForVersion(pattern));

        verify(patternCollection).find(new Document("namespace", pattern.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("patterns")));
    }

    @Test
    void return_a_pattern_for_a_given_version() throws PatternNotFoundException, PatternVersionNotFoundException, NamespaceNotFoundException {
        mockSetupPatternDocumentWithVersions();

        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos")
                .setId(42).setVersion("1.0.0").build();

        String patternForVersion = mongoPatternStore.getPatternForVersion(pattern);
        assertThat(patternForVersion, is(validJson));
    }


    private Document setupPatternVersionDocument() {
        //Set up a patterns document with 2 patterns in (one with a valid version)
        Map<String, Document> versionMap = new HashMap<>();
        versionMap.put("1-0-0", Document.parse(validJson));
        Document targetStoredPattern = new Document("patternId", 42)
                .append("versions", new Document(versionMap));

        Document paddingPattern = new Document("patternId", 0);

        Document mainDocument = new Document("namespace", "finos")
                .append("patterns", Arrays.asList(paddingPattern, targetStoredPattern));

        return mainDocument;
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
    void throw_an_exception_when_pattern_for_given_version_does_not_exist()  {
        mockSetupPatternDocumentWithVersions();

        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos")
                .setId(42).setVersion("9.0.0").build();

        assertThrows(PatternVersionNotFoundException.class,
                () -> mongoPatternStore.getPatternForVersion(pattern));
    }

    @Test
    void throw_an_exception_when_create_or_update_pattern_for_version_with_a_namespace_that_doesnt_exists() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos")
                .setId(42).setVersion("9.0.0").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.createPatternForVersion(pattern));
        assertThrows(NamespaceNotFoundException.class,
                () -> mongoPatternStore.updatePatternForVersion(pattern));

        verify(namespaceStore, times(2)).namespaceExists(pattern.getNamespace());
    }

    @Test
    void throw_an_exception_when_create_on_a_version_that_exists() {
        mockSetupPatternDocumentWithVersions();

        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos")
                .setId(42).setVersion("1.0.0").build();

        assertThrows(PatternVersionExistsException.class,
                () -> mongoPatternStore.createPatternForVersion(pattern));
    }

    @Test
    void throw_a_pattern_not_found_exception_when_creating_or_updating_a_version() {
        mockSetupPatternDocumentWithVersions();
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos")
                .setId(50).setVersion("1.0.1")
                .setPattern(validJson).build();

        WriteError writeError = new WriteError(2, "The positional operator did not find the match needed from the query", new BsonDocument());
        MongoWriteException mongoWriteException = new MongoWriteException(writeError, new ServerAddress());

        when(patternCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(mongoWriteException);

        assertThrows(PatternNotFoundException.class,
                () -> mongoPatternStore.createPatternForVersion(pattern));
        assertThrows(PatternNotFoundException.class,
                () -> mongoPatternStore.updatePatternForVersion(pattern));
    }

    @Test
    void accept_the_creation_or_update_of_a_valid_version() throws PatternNotFoundException, NamespaceNotFoundException, PatternVersionExistsException {
        mockSetupPatternDocumentWithVersions();
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos")
                .setId(50).setVersion("1.0.1")
                .setPattern(validJson).build();

        mongoPatternStore.updatePatternForVersion(pattern);
        mongoPatternStore.createPatternForVersion(pattern);

        verify(patternCollection, times(2)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }
}
