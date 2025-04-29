package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Interface;
import org.finos.calm.domain.InterfaceRequest;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.InterfaceStore;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@QuarkusTest
class TestInterfaceResourceShould {

    @InjectMock
    InterfaceStore interfaceStore;

    @Test
    void return_a_404_when_invalid_namespace_is_provided_on_create_interface() throws NamespaceNotFoundException {
        when(interfaceStore.createInterfaceForNamespace(any(Interface.class)))
                .thenThrow(new NamespaceNotFoundException());

        InterfaceRequest request = new InterfaceRequest("test", "test description", "{\"test\":\"json\"}");

        given()
                .header("Content-Type", "application/json")
                .body(request)
                .when()
                .post("/calm/namespaces/invalid/interfaces")
                .then()
                .statusCode(404);

        Interface interfaceToCreate = new Interface.InterfaceBuilder()
                .setNamespace("invalid")
                .setName("test")
                .setDescription("test description")
                .setInterfaceJson("{\"test\":\"json\"}")
                .build();

        verify(interfaceStore, times(1)).createInterfaceForNamespace(interfaceToCreate);
    }

    @Test
    void return_a_400_when_invalid_json_is_provided_on_create_interface() throws JsonParseException, NamespaceNotFoundException {
        when(interfaceStore.createInterfaceForNamespace(any(Interface.class)))
                .thenThrow(new JsonParseException());

        InterfaceRequest request = new InterfaceRequest("test", "test description", "invalid json");

        given()
                .header("Content-Type", "application/json")
                .body(request)
                .when()
                .post("/calm/namespaces/finos/interfaces")
                .then()
                .statusCode(400);

        Interface interfaceToCreate = new Interface.InterfaceBuilder()
                .setNamespace("finos")
                .setName("test")
                .setDescription("test description")
                .setInterfaceJson("invalid json")
                .build();

        verify(interfaceStore, times(1)).createInterfaceForNamespace(interfaceToCreate);
    }

    @Test
    void return_a_created_with_location_of_interface_when_creating_interface() throws NamespaceNotFoundException {
        String namespace = "valid";

        InterfaceRequest request = new InterfaceRequest("test", "test description", "{ \"test\":\"json\"}");

        Interface expectedInterface = new Interface.InterfaceBuilder()
                .setVersion("1.0.0")
                .setId(17)
                .setNamespace(namespace)
                .setName("test")
                .setDescription("test description")
                .setInterfaceJson("{ \"test\":\"json\"}")
                .build();

        when(interfaceStore.createInterfaceForNamespace(any(Interface.class))).thenReturn(expectedInterface);

        given()
                .header("Content-Type", "application/json")
                .contentType(ContentType.JSON)
                .body(request)
                .when()
                .post("/calm/namespaces/valid/interfaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/valid/interfaces/17/versions/1.0.0"));

        Interface interfaceToCreate = new Interface.InterfaceBuilder()
                .setNamespace(namespace)
                .setName("test")
                .setDescription("test description")
                .setInterfaceJson("{ \"test\":\"json\"}")
                .build();
        verify(interfaceStore, times(1)).createInterfaceForNamespace(interfaceToCreate);
    }
}