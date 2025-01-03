package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Adr;
import org.finos.calm.domain.AdrBuilder;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestAdrResourceShould {

    @InjectMock
    AdrStore mockAdrStore;

    @Test
    void return_a_404_when_an_invalid_namespace_is_provided_on_get_adrs() throws NamespaceNotFoundException {
        when(mockAdrStore.getAdrsForNamespace(anyString())).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/invalid/adrs")
                .then()
                .statusCode(404);

        verify(mockAdrStore, times(1)).getAdrsForNamespace("invalid");
    }

    @Test
    void return_list_of_adr_ids_when_valid_namespace_provided_on_get_adrs() throws NamespaceNotFoundException {
        when(mockAdrStore.getAdrsForNamespace(anyString())).thenReturn(Arrays.asList(12345,54321));

        given()
                .when()
                .get("/calm/namespaces/finos/adrs")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[12345,54321]}"));

        verify(mockAdrStore, times(1)).getAdrsForNamespace("finos");
    }

    @Test
    void return_a_404_when_invalid_namespace_is_provided_on_create_adr() throws NamespaceNotFoundException {
        when(mockAdrStore.createAdrForNamespace(any(Adr.class)))
                .thenThrow(new NamespaceNotFoundException());

        String adr = "{ \"test\": \"json\" }";

        given()
                .header("Content-Type", "application/json")
                .body(adr)
                .when()
                .post("/calm/namespaces/invalid/adrs")
                .then()
                .statusCode(404);

        Adr expectedAdr = AdrBuilder.builder()
                .adr(adr)
                .revision(1)
                .namespace("invalid")
                .build();

        verify(mockAdrStore, times(1)).createAdrForNamespace(expectedAdr);
    }

    @Test
    void return_a_400_when_invalid_adr_json_is_provided_on_create_adr() throws NamespaceNotFoundException {
        when(mockAdrStore.createAdrForNamespace(any(Adr.class)))
                .thenThrow(new JsonParseException());

        String adr = "{ \"test\": im invalid json";

        given()
                .header("Content-Type", "application/json")
                .body(adr)
                .when()
                .post("/calm/namespaces/invalid/adrs")
                .then()
                .statusCode(400);

        Adr expectedAdr = AdrBuilder.builder()
                .adr(adr)
                .namespace("invalid")
                .revision(1)
                .build();

        verify(mockAdrStore, times(1)).createAdrForNamespace(expectedAdr);
    }

    @Test
    void return_a_created_with_location_of_adr_when_creating_adr() throws NamespaceNotFoundException {
        String adrJson = "{ \"test\": \"json\" }";
        String namespace = "finos";

        Adr stubbedReturnAdr = AdrBuilder.builder()
                .adr(adrJson)
                .revision(1)
                .id(12)
                .namespace(namespace)
                .build();

        when(mockAdrStore.createAdrForNamespace(any(Adr.class))).thenReturn(stubbedReturnAdr);

        given()
                .header("Content-Type", "application/json")
                .body(adrJson)
                .when()
                .post("/calm/namespaces/finos/adrs")
                .then()
                .statusCode(201)
                //Derived from stubbed architecture in resource
                .header("Location", containsString("/calm/namespaces/finos/adrs/12/revisions/1"));

        Adr expectedAdrToCreate = AdrBuilder.builder()
                .adr(adrJson)
                .namespace(namespace)
                .revision(1)
                .build();

        verify(mockAdrStore, times(1)).createAdrForNamespace(expectedAdrToCreate);
    }

}
