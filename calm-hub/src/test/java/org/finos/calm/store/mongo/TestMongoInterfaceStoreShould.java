package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
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
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.*;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
public class TestMongoInterfaceStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private MongoCollection<Document> interfaceCollection;

    private MongoInterfaceStore mongoInterfaceStore;

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    @BeforeEach
    void setup() {
        interfaceCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("interfaces")).thenReturn(interfaceCollection);
        mongoInterfaceStore = new MongoInterfaceStore(mongoDatabase, counterStore, namespaceStore);
    }

    @Test
    void get_interface_for_namespace_returns_empty_list_when_none_exist() throws NamespaceNotFoundException {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(interfaceCollection.find(eq(Filters.eq("namespace", "finos"))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);
        when(documentMock.getList("interfaces", Document.class))
                .thenReturn(new ArrayList<>());

        assertThat(mongoInterfaceStore.getInterfacesForNamespace("finos"), is(empty()));
        verify(namespaceStore).namespaceExists("finos");
    }

    @Test
    void get_interface_for_namespace_returns_empty_list_when_mongo_collection_not_created() throws NamespaceNotFoundException {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(interfaceCollection.find(eq(Filters.eq("namespace", "finos"))))
                .thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoInterfaceStore.getInterfacesForNamespace("finos"), is(empty()));
        verify(namespaceStore).namespaceExists("finos");
    }

    @Test
    void get_interface_for_namespace_that_doesnt_exist_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoInterfaceStore.getInterfacesForNamespace(namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void get_interface_for_namespace_returns_values() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(interfaceCollection.find(eq(Filters.eq("namespace", "finos"))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        Map<String, Object> interfaceDetailMap = new HashMap<>();
        interfaceDetailMap.put("interfaceId", 55);
        interfaceDetailMap.put("name", "Test Interface");
        interfaceDetailMap.put("description", "Test Description");

        Document doc = new Document(interfaceDetailMap);

        when(documentMock.getList("interfaces", Document.class))
                .thenReturn(List.of(doc));

        List<NamespaceInterfaceSummary> interfaces = mongoInterfaceStore.getInterfacesForNamespace("finos");

        assertThat(interfaces.size(), is(1));
        assertThat(interfaces.getFirst().getName(), is("Test Interface"));
        assertThat(interfaces.getFirst().getDescription(), is("Test Description"));
        assertThat(interfaces.getFirst().getId(), is(55));

        verify(namespaceStore).namespaceExists("finos");
    }

    private DocumentFindIterable setupInvalidInterface() {
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(interfaceCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        return findIterable;
    }

    private void mockSetupInterfaceDocumentWithVersions() {
        Document mainDocument = setupInterfaceVersionDocument();
        DocumentFindIterable findIterable = Mockito.mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(interfaceCollection.find(any(Bson.class)))
                .thenReturn(findIterable);
        when(findIterable.projection(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(mainDocument);
    }

    @Test
    void return_a_namespace_exception_when_namespace_does_not_exist_when_creating_interface() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";
        CreateInterfaceRequest createInterfaceRequest = new CreateInterfaceRequest();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoInterfaceStore.createInterfaceForNamespace(createInterfaceRequest, namespace));

        verify(namespaceStore).namespaceExists(namespace);
    }

    @Test
    void return_created_interface_when_parameters_are_valid() throws NamespaceNotFoundException {
        String validNamespace = "finos";
        int sequenceNumber = 42;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextInterfaceSequenceValue()).thenReturn(sequenceNumber);

        CreateInterfaceRequest interfaceToCreate = new CreateInterfaceRequest(
                "test",
                "Test Interface",
                "{}"
        );

        CalmInterface createdInterface = mongoInterfaceStore.createInterfaceForNamespace(interfaceToCreate, validNamespace);

        CalmInterface expectedInterface = new CalmInterface(interfaceToCreate);
        expectedInterface.setVersion("1.0.0");
        expectedInterface.setId(sequenceNumber);

        assertThat(createdInterface, is(expectedInterface));

        Document expectedDoc = new Document("interfaceId", sequenceNumber)
                .append("name", interfaceToCreate.getName())
                .append("description", interfaceToCreate.getDescription())
                .append("versions", new Document("1-0-0", Document.parse(interfaceToCreate.getInterfaceJson())));

        verify(interfaceCollection).updateOne(
                eq(Filters.eq("namespace", validNamespace)),
                eq(Updates.push("interfaces", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void get_interface_versions_for_invalid_namespace_throws_exception() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoInterfaceStore.getInterfaceVersions("does-not-exist", 5));

        verify(namespaceStore).namespaceExists("does-not-exist");
    }

    @Test
    void get_interface_versions_for_invalid_interface_throws_exception() {
        FindIterable<Document> findIterable = setupInvalidInterface();

        assertThrows(InterfaceNotFoundException.class,
                () -> mongoInterfaceStore.getInterfaceVersions("finos", 5));

        verify(interfaceCollection).find(new Document("namespace", "finos"));
        verify(findIterable).projection(Projections.fields(Projections.include("interfaces")));
    }

    @Test
    void get_interface_versions_for_interface_returns_list_of_versions() throws InterfaceNotFoundException, NamespaceNotFoundException {
        mockSetupInterfaceDocumentWithVersions();

        List<String> interfaceVersions = mongoInterfaceStore.getInterfaceVersions("finos", 42);

        assertThat(interfaceVersions, is(List.of("1.0.0")));
    }

    @Test
    void throw_an_exception_for_an_invalid_namespace_when_retrieving_interface_for_version() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String invalidNamespace = "does-not-exist";

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoInterfaceStore.getInterfaceForVersion(invalidNamespace, null, null));

        verify(namespaceStore).namespaceExists(invalidNamespace);
    }

    @Test
    void throw_an_exception_for_an_invalid_interface_when_retrieving_interface_for_version() {
        FindIterable<Document> findIterable = setupInvalidInterface();
        String validNamespace = "finos";

        assertThrows(InterfaceNotFoundException.class,
                () -> mongoInterfaceStore.getInterfaceForVersion(validNamespace, 1, null));

        verify(interfaceCollection).find(new Document("namespace", validNamespace));
        verify(findIterable).projection(Projections.fields(Projections.include("interfaces")));
    }

    @Test
    void return_an_interface_for_a_given_version() throws InterfaceNotFoundException, InterfaceVersionNotFoundException, NamespaceNotFoundException {
        mockSetupInterfaceDocumentWithVersions();

        String interfaceForVersion = mongoInterfaceStore.getInterfaceForVersion("finos", 42, "1.0.0");
        assertThat(interfaceForVersion, is("{}"));
    }

    private Document setupInterfaceVersionDocument() {
        Map<String, Document> versionMap = new HashMap<>();
        versionMap.put("1-0-0", Document.parse("{}"));
        Document targetStoredInterface = new Document("interfaceId", 42)
                .append("versions", new Document(versionMap));

        Document paddingInterface = new Document("interfaceId", 0);

        return new Document("namespace", "finos")
                .append("interfaces", Arrays.asList(paddingInterface, targetStoredInterface));
    }

    @Test
    void throw_an_exception_when_interface_for_given_version_does_not_exist() {
        mockSetupInterfaceDocumentWithVersions();

        assertThrows(InterfaceVersionNotFoundException.class,
                () -> mongoInterfaceStore.getInterfaceForVersion("finos", 42, "9.0.0"));
    }

    @Test
    void throw_an_exception_for_create_interface_for_version_when_a_namespace_doesnt_exist() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> mongoInterfaceStore.createInterfaceForVersion(interfaceToStore(), "finos", 42, "9.0.0"));
    }

    @Test
    void throw_an_exception_for_create_interface_for_version_when_an_interface_doesnt_exist() {
        mockSetupInterfaceDocumentWithVersions();
        CreateInterfaceRequest interfaceRequest = interfaceToStore();

        WriteError writeError = new WriteError(2, "The positional operator did not find the match needed from the query", new BsonDocument());
        MongoWriteException mongoWriteException = new MongoWriteException(writeError, new ServerAddress(), Set.of("label"));
        when(interfaceCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class))).thenThrow(mongoWriteException);

        assertThrows(InterfaceNotFoundException.class, () -> mongoInterfaceStore.createInterfaceForVersion(interfaceRequest, "finos", 50, "1.0.1"));
    }

    @Test
    void throw_an_exception_for_create_interface_for_version_when_a_version_already_exists() {
        mockSetupInterfaceDocumentWithVersions();
        CreateInterfaceRequest interfaceRequest = interfaceToStore();

        assertThrows(InterfaceVersionExistsException.class, () -> mongoInterfaceStore.createInterfaceForVersion(interfaceRequest, "finos", 42, "1.0.0"));
    }

    @Test
    void accept_the_creation_of_a_valid_version() throws InterfaceVersionExistsException, InterfaceNotFoundException, NamespaceNotFoundException {
        mockSetupInterfaceDocumentWithVersions();
        CreateInterfaceRequest interfaceRequest = interfaceToStore();
        mongoInterfaceStore.createInterfaceForVersion(interfaceRequest, "finos", 42, "1.0.1");

        verify(interfaceCollection).updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class));
    }

    private CreateInterfaceRequest interfaceToStore() {
        return new CreateInterfaceRequest("Second Version", "Second Description", "{}");
    }
}
