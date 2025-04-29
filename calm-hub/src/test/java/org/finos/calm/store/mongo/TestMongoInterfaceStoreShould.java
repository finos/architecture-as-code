package org.finos.calm.store.mongo;


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
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
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
}