package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Adr;
import org.finos.calm.domain.AdrBuilder;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

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
                //Derived from stubbed adr in resource
                .header("Location", containsString("/calm/namespaces/finos/adrs/12/revisions/1"));

        Adr expectedAdrToCreate = AdrBuilder.builder()
                .adr(adrJson)
                .namespace(namespace)
                .revision(1)
                .build();

        verify(mockAdrStore, times(1)).createAdrForNamespace(expectedAdrToCreate);
    }

    //Update ADR Tests

    static Stream<Arguments> provideParametersForUpdateAdrTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new AdrNotFoundException(), 404),
                Arguments.of("valid", new AdrRevisionNotFoundException(), 404),
                Arguments.of("valid", null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForUpdateAdrTests")
    void return_a_404_when_invalid_namespace_is_provided_on_update_adr(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        String adrJson = "{ \"test\": \"json\" }";
        if (exceptionToThrow != null) {
            when(mockAdrStore.updateAdrForNamespace(any(Adr.class))).thenThrow(exceptionToThrow);
        } else {
            Adr adr = AdrBuilder.builder()
                    .adr(adrJson)
                    .id(2)
                    .namespace(namespace)
                    .build();
            when(mockAdrStore.updateAdrForNamespace(any(Adr.class))).thenReturn(adr);
        }

        given()
                .header("Content-Type", "application/json")
                .body(adrJson)
                .when()
                .post("/calm/namespaces/invalid/adrs/1")
                .then()
                .statusCode(expectedStatusCode);

        Adr expectedAdr = AdrBuilder.builder()
                .adr(adrJson)
                .id(1)
                .namespace("invalid")
                .build();

        verify(mockAdrStore, times(1)).updateAdrForNamespace(expectedAdr);
    }

    static Stream<Arguments> provideParametersForAdrRevisionTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new AdrNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForAdrRevisionTests")
    void respond_correctly_to_get_adr_revisions_query(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException {
        var revisions = List.of(1, 2);
        if (exceptionToThrow != null) {
            when(mockAdrStore.getAdrRevisions(any(Adr.class))).thenThrow(exceptionToThrow);
        } else {
            when(mockAdrStore.getAdrRevisions(any(Adr.class))).thenReturn(revisions);
        }

        if (expectedStatusCode == 200 ) {
            String expectedBody = "{\"values\":[1,2]}";
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12/revisions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo(expectedBody));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12/revisions")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verifyExpectedAdrRevisions(namespace);
    }

    private void verifyExpectedAdrRevisions(String namespace) throws NamespaceNotFoundException, AdrNotFoundException {
        Adr expectedAdrToRetrieve = AdrBuilder.builder()
                .namespace(namespace)
                .id(12)
                .build();

        verify(mockAdrStore, times(1)).getAdrRevisions(expectedAdrToRetrieve);
    }


    static Stream<Arguments> provideParametersForGetAdrRevisionTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new AdrNotFoundException(), 404),
                Arguments.of("valid", new AdrRevisionNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetAdrRevisionTests")
    void respond_correctly_to_get_adr_revision(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        if (exceptionToThrow != null) {
            when(mockAdrStore.getAdrRevision(any(Adr.class))).thenThrow(exceptionToThrow);
        } else {
            String adr = "{ \"test\": \"json\" }";
            when(mockAdrStore.getAdrRevision(any(Adr.class))).thenReturn(adr);
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12/revisions/1")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo("{ \"test\": \"json\" }"));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12/revisions/1")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verifyExpectedGetAdrRevision(namespace);
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetAdrRevisionTests")
    void respond_correctly_to_get_adr(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        if (exceptionToThrow != null) {
            when(mockAdrStore.getAdr(any(Adr.class))).thenThrow(exceptionToThrow);
        } else {
            String adr = "{ \"test\": \"json\" }";
            when(mockAdrStore.getAdr(any(Adr.class))).thenReturn(adr);
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo("{ \"test\": \"json\" }"));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verifyExpectedGetAdr(namespace);
    }

    private void verifyExpectedGetAdrRevision(String namespace) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        Adr expectedAdrToRetrieve = AdrBuilder.builder()
                .namespace(namespace)
                .id(12)
                .revision(1)
                .build();

        verify(mockAdrStore, times(1)).getAdrRevision(expectedAdrToRetrieve);
    }

    private void verifyExpectedGetAdr(String namespace) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        Adr expectedAdrToRetrieve = AdrBuilder.builder()
                .namespace(namespace)
                .id(12)
                .build();

        verify(mockAdrStore, times(1)).getAdr(expectedAdrToRetrieve);
    }

}
