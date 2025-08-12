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
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
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
public class TestMongoArchitectureStoreShould {

    @InjectMock
    MongoClient mongoClient;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private MongoCollection<Document> architectureCollection;
    private MongoArchitectureStore mongoArchitectureStore;
    private final String NAMESPACE = "finos";

    private final String validJson = "{\"test\": \"test\"}";

    @BeforeEach
    void setup() {
        MongoDatabase mongoDatabase = Mockito.mock(MongoDatabase.class);
        architectureCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("architectures")).thenReturn(architectureCollection);
        mongoArchitectureStore = new MongoArchitectureStore(mongoClient, counterStore, namespaceStore);
    }

    @Test
    void get_architectures_for_namespace_returns_empty_list_when_none_exist() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(architectureCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);
        when(documentMock.getList("architectures", Document.class))
                .thenReturn(new ArrayList<>());

        assertThat(mongoArchitectureStore.getArchitecturesForNamespace(NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void get_architectures_for_namespace_returns_empty_list_when_mongo_collection_not_created() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(architectureCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoArchitectureStore.getArchitecturesForNamespace(NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    @Test
    void get_architecture_for_namespace_that_doesnt_exist_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoArchitectureStore.getArchitecturesForNamespace(namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void get_architecture_for_namespace_returns_values() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(architectureCollection.find(eq(Filters.eq("namespace", NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        Document doc1 = new Document("architectureId", 1001);
        Document doc2 = new Document("architectureId", 1002);

        when(documentMock.getList("architectures", Document.class))
                .thenReturn(Arrays.asList(doc1, doc2));

        List<Integer> architectureIds = mongoArchitectureStore.getArchitecturesForNamespace(NAMESPACE);

        assertThat(architectureIds, is(Arrays.asList(1001, 1002)));
        verify(namespaceStore).namespaceExists(NAMESPACE);
    }

    private FindIterable<Document> setupInvalidArchitecture() {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        //Return the same find iterable as the projection unboxes, then return null
        when(architectureCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);


        return findIterable;
    }

    private void mockSetupArchitectureDocumentWithVersions() {
        Document mainDocument = setupArchitectureVersionDocument();
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(architectureCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    @Test
    void return_a_namespace_exception_when_namespace_does_not_exist_when_creating_an_architecture() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";
        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(namespace).build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoArchitectureStore.createArchitectureForNamespace(architecture));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_a_json_parse_exception_when_an_invalid_json_object_is_presented() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextArchitectureSequenceValue()).thenReturn(42);
        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE)
                .setArchitecture("Invalid JSON")
                .build();

        assertThrows(JsonParseException.class,
                () -> mongoArchitectureStore.createArchitectureForNamespace(architecture));
    }

    @Test
    void return_created_architecture_when_parameters_are_valid() throws NamespaceNotFoundException {
        String validNamespace = NAMESPACE;
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextArchitectureSequenceValue()).thenReturn(sequenceNumber);
        Architecture architectureToCreate = new Architecture.ArchitectureBuilder().setArchitecture(validJson)
                .setNamespace(validNamespace)
                .build();

        Architecture architecture = mongoArchitectureStore.createArchitectureForNamespace(architectureToCreate);

        Architecture expectedArchitecture = new Architecture.ArchitectureBuilder().setArchitecture(validJson)
                .setNamespace(validNamespace)
                .setVersion("1.0.0")
                .setId(sequenceNumber)
                .build();

        assertThat(architecture, is(expectedArchitecture));
        Document expectedDoc = new Document("architectureId", architecture.getId()).append("versions",
                new Document("1-0-0", Document.parse(architecture.getArchitectureJson())));

        verify(architectureCollection).updateOne(
                eq(Filters.eq("namespace", validNamespace)),
                eq(Updates.push("architectures", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void get_architecture_version_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoArchitectureStore.getArchitectureVersions(architecture));

        verify(namespaceStore).namespaceExists(architecture.getNamespace());
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    @Test
    void get_architecture_version_for_invalid_pattern_throws_exception() {
        FindIterable<Document> findIterable = setupInvalidArchitecture();
        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE).build();

        assertThrows(ArchitectureNotFoundException.class,
                () -> mongoArchitectureStore.getArchitectureVersions(architecture));

        verify(architectureCollection).find(new Document("namespace", architecture.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("architectures")));
    }

    @Test
    void get_architecture_versions_for_valid_architecture_returns_list_of_versions() throws ArchitectureNotFoundException, NamespaceNotFoundException {
        mockSetupArchitectureDocumentWithVersions();

        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE).setId(42).build();
        List<String> architectureVersions = mongoArchitectureStore.getArchitectureVersions(architecture);

        assertThat(architectureVersions, is(List.of("1.0.0")));
    }

    @Test
    void throw_an_exception_for_an_invalid_namespace_when_retrieving_architecture_for_version() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace("does-not-exist").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoArchitectureStore.getArchitectureVersions(architecture));

        verify(namespaceStore).namespaceExists(architecture.getNamespace());
    }

    @Test
    void throw_an_exception_for_an_invalid_architecture_when_retrieving_architecture_for_version() {
        FindIterable<Document> findIterable = setupInvalidArchitecture();
        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE).build();

        assertThrows(ArchitectureNotFoundException.class,
                () -> mongoArchitectureStore.getArchitectureForVersion(architecture));

        verify(architectureCollection).find(new Document("namespace", architecture.getNamespace()));
        verify(findIterable).projection(Projections.fields(Projections.include("architectures")));
    }

    @Test
    void return_an_architecture_for_a_given_version() throws ArchitectureNotFoundException, ArchitectureVersionNotFoundException, NamespaceNotFoundException {
        mockSetupArchitectureDocumentWithVersions();

        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("1.0.0").build();

        String architectureForVersion = mongoArchitectureStore.getArchitectureForVersion(architecture);
        assertThat(architectureForVersion, is(validJson));
    }


    private Document setupArchitectureVersionDocument() {
        //Set up an architecture document with 2 architectures in (one with a valid version)
        Map<String, Document> versionMap = new HashMap<>();
        versionMap.put("1-0-0", Document.parse(validJson));
        Document targetStoredArchitecture = new Document("architectureId", 42)
                .append("versions", new Document(versionMap));

        Document paddingArchitecture = new Document("architectureId", 0);

        return new Document("namespace", NAMESPACE)
                .append("architectures", Arrays.asList(paddingArchitecture, targetStoredArchitecture));
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    @Test
    void throw_an_exception_when_architecture_for_given_version_does_not_exist()  {
        mockSetupArchitectureDocumentWithVersions();

        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("9.0.0").build();

        assertThrows(ArchitectureVersionNotFoundException.class,
                () -> mongoArchitectureStore.getArchitectureForVersion(architecture));
    }

    @Test
    void throw_an_exception_when_create_or_update_architecture_for_version_with_a_namespace_that_doesnt_exists() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("9.0.0").build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoArchitectureStore.createArchitectureForVersion(architecture));
        assertThrows(NamespaceNotFoundException.class,
                () -> mongoArchitectureStore.updateArchitectureForVersion(architecture));

        verify(namespaceStore, times(2)).namespaceExists(architecture.getNamespace());
    }

    @Test
    void throw_an_exception_when_create_on_a_version_that_exists() {
        mockSetupArchitectureDocumentWithVersions();

        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE)
                .setId(42).setVersion("1.0.0").build();

        assertThrows(ArchitectureVersionExistsException.class,
                () -> mongoArchitectureStore.createArchitectureForVersion(architecture));
    }

    @Test
    void throw_an_architecture_not_found_exception_when_creating_or_updating_a_version() {
        mockSetupArchitectureDocumentWithVersions();
        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE)
                .setId(50).setVersion("1.0.1")
                .setArchitecture(validJson).build();

        WriteError writeError = new WriteError(2, "The positional operator did not find the match needed from the query", new BsonDocument());
        MongoWriteException mongoWriteException = new MongoWriteException(writeError, new ServerAddress());

        when(architectureCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(mongoWriteException);

        assertThrows(ArchitectureNotFoundException.class,
                () -> mongoArchitectureStore.createArchitectureForVersion(architecture));
        assertThrows(ArchitectureNotFoundException.class,
                () -> mongoArchitectureStore.updateArchitectureForVersion(architecture));
    }

    @Test
    void accept_the_creation_or_update_of_a_valid_version() throws ArchitectureNotFoundException, NamespaceNotFoundException, ArchitectureVersionExistsException {
        mockSetupArchitectureDocumentWithVersions();
        Architecture architecture = new Architecture.ArchitectureBuilder().setNamespace(NAMESPACE)
                .setId(50).setVersion("1.0.1")
                .setArchitecture(validJson).build();

        mongoArchitectureStore.updateArchitectureForVersion(architecture);
        mongoArchitectureStore.createArchitectureForVersion(architecture);

        verify(architectureCollection, times(2)).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }
}
