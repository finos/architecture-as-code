package org.finos.calm.store.mongo;


import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.Document;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Interface;
import org.finos.calm.domain.InterfaceMeta;
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
class TestMongoInterfaceStoreShould {

    private final String VALID_NAMESPACE = "finos";
    @InjectMock
    MongoClient mongoClient;
    @InjectMock
    MongoCounterStore counterStore;
    @InjectMock
    MongoNamespaceStore namespaceStore;

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> interfaceCollection;
    private MongoInterfaceStore mongoInterfaceStore;

    @BeforeEach
    void setup() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
        interfaceCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("interfaces")).thenReturn(interfaceCollection);
        mongoInterfaceStore = new MongoInterfaceStore(mongoClient, counterStore, namespaceStore);
    }

    @Test
    void return_created_interface_when_parameters_are_valid() throws NamespaceNotFoundException {
        int sequenceNumber = 17;
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextInterfaceSequenceValue()).thenReturn(sequenceNumber);

        Interface interfaceToCreate = new Interface.InterfaceBuilder()
                .setNamespace(VALID_NAMESPACE)
                .setName("test")
                .setDescription("test description")
                .setInterfaceJson("{ \"test\":\"json\"}")
                .build();

        Interface createdInterface = mongoInterfaceStore.createInterfaceForNamespace(interfaceToCreate);
        Interface expectedInterface = new Interface.InterfaceBuilder()
                .setNamespace(VALID_NAMESPACE)
                .setName("test")
                .setDescription("test description")
                .setInterfaceJson("{ \"test\":\"json\"}")
                .setVersion("1.0.0")
                .setId(sequenceNumber)
                .build();

        assertThat(createdInterface, is(expectedInterface));
        Document expectedDoc = new Document(
                Map.of("interfaceId", createdInterface.getId(),
                        "name", createdInterface.getName(),
                        "description", createdInterface.getDescription()))
                .append("versions",
                        new Document("1-0-0", Document.parse(createdInterface.getInterfaceJson())));

        verify(interfaceCollection).updateOne(
                eq(Filters.eq("namespace", VALID_NAMESPACE)),
                eq(Updates.push("interfaces", expectedDoc)),
                any(UpdateOptions.class));
    }

    @Test
    void return_a_namespace_exception_when_namespace_does_not_exist_when_creating_an_interface() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        String namespace = "does-not-exist";
        Interface interfaceToCreate = new Interface.InterfaceBuilder()
                .setNamespace(namespace)
                .build();
        assertThrows(NamespaceNotFoundException.class,
                () -> mongoInterfaceStore.createInterfaceForNamespace(interfaceToCreate));

        verify(namespaceStore).namespaceExists(namespace);
        verifyNoInteractions(counterStore);
    }

    @Test
    void return_a_json_parse_exception_when_invalid_json_is_presented_for_creating_an_interface() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextInterfaceSequenceValue()).thenReturn(17);
        Interface interfaceToCreate = new Interface.InterfaceBuilder()
                .setNamespace(VALID_NAMESPACE)
                .setName("test")
                .setDescription("test description")
                .setInterfaceJson("no valid json")
                .build();

        assertThrows(JsonParseException.class,
                () -> mongoInterfaceStore.createInterfaceForNamespace(interfaceToCreate));
    }

    @Test
    void get_interfaces_for_namespace_returns_empty_list_when_none_exist() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(interfaceCollection.find(eq(Filters.eq("namespace", VALID_NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);
        when(documentMock.getList("interfaces", Document.class))
                .thenReturn(new ArrayList<>());

        assertThat(mongoInterfaceStore.getInterfacesForNamespace(VALID_NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(VALID_NAMESPACE);
    }

    @Test
    void get_interfaces_for_namespace_returns_empty_list_when_mongo_collection_not_created() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(interfaceCollection.find(eq(Filters.eq("namespace", VALID_NAMESPACE))))
                .thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThat(mongoInterfaceStore.getInterfacesForNamespace(VALID_NAMESPACE), is(empty()));
        verify(namespaceStore).namespaceExists(VALID_NAMESPACE);
    }



    @Test
    void get_flow_for_namespace_returns_values() throws NamespaceNotFoundException {
        FindIterable<Document> findIterable = Mockito.mock(FindIterable.class);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(interfaceCollection.find(eq(Filters.eq("namespace", VALID_NAMESPACE))))
                .thenReturn(findIterable);
        Document documentMock = Mockito.mock(Document.class);
        when(findIterable.first()).thenReturn(documentMock);

        Document doc1 = new Document(
                Map.of("interfaceId", 1,
                        "name", "test-interface",
                        "description","interface description"))
                .append("versions", new Document("1-0-0", Document.parse("{\"test\":\"json\"}")));


        when(documentMock.getList("interfaces", Document.class)).thenReturn(Collections.singletonList(doc1));

        List<InterfaceMeta> interfaces = mongoInterfaceStore.getInterfacesForNamespace(VALID_NAMESPACE);

        assertThat(interfaces, is(List.of(new InterfaceMeta(1, "test-interface", "interface description"))));
        verify(namespaceStore).namespaceExists(VALID_NAMESPACE);
    }
}