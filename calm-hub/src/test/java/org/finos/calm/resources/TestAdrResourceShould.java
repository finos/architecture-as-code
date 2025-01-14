package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Adr;
import org.finos.calm.domain.AdrBuilder;
import org.finos.calm.domain.AdrContentBuilder;
import org.finos.calm.domain.AdrStatus;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.hamcrest.Matcher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
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
        when(mockAdrStore.getAdrsForNamespace(anyString())).thenReturn(Arrays.asList(12345, 54321));

        given()
                .when()
                .get("/calm/namespaces/finos/adrs")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[12345,54321]}"));

        verify(mockAdrStore, times(1)).getAdrsForNamespace("finos");
    }

    static Stream<Arguments> provideParametersForCreateAdrTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404, nullValue()),
                Arguments.of("invalid", new JsonParseException(), 400, nullValue()),
                Arguments.of("valid", null, 201, containsString("/calm/namespaces/valid/adrs/12/revisions/1"))
        );
    }


    @ParameterizedTest
    @MethodSource("provideParametersForCreateAdrTests")
    void respond_correctly_when_creating_adr(String namespace, Throwable exceptionToThrow, int expectedStatusCode, Matcher<?> locationHeader) throws NamespaceNotFoundException, JsonProcessingException {
        if (exceptionToThrow != null) {
            when(mockAdrStore.createAdrForNamespace(any(Adr.class))).thenThrow(exceptionToThrow);
        } else {
            Adr adr = AdrBuilder.builder()
                    .adrContent(
                            AdrContentBuilder.builder()
                                    .title("My ADR")
                                    .status(AdrStatus.DRAFT)
                                    .creationDateTime(LocalDateTime.now())
                                    .updateDateTime(LocalDateTime.now())
                                    .build()
                    )
                    .id(12)
                    .revision(1)
                    .namespace(namespace)
                    .build();
            when(mockAdrStore.createAdrForNamespace(any(Adr.class))).thenReturn(adr);
        }

        String adr = "{ \"title\": \"My ADR\" }";

        given()
                .header("Content-Type", "application/json")
                .body(adr)
                .when()
                .post("/calm/namespaces/" + namespace +"/adrs")
                .then()
                .statusCode(expectedStatusCode)
                .header("Location", locationHeader);

        Adr expectedAdr = AdrBuilder.builder()
                .adrContent(
                        AdrContentBuilder.builder()
                                .title("My ADR")
                                .status(AdrStatus.DRAFT)
                                .build())
                .revision(1)
                .namespace(namespace)
                .build();

        verify(mockAdrStore, times(1)).createAdrForNamespace(expectedAdr);
    }

//    //Update ADR Tests

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
    void return_a_404_when_invalid_namespace_is_provided_on_update_adr(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        String adrJson = "{ \"title\": \"My ADR\" }";
        if (exceptionToThrow != null) {
            when(mockAdrStore.updateAdrForNamespace(any(Adr.class))).thenThrow(exceptionToThrow);
        } else {
            Adr adr = AdrBuilder.builder()
                    .adrContent(
                            AdrContentBuilder.builder()
                                    .title("My ADR")
                                    .status(AdrStatus.DRAFT)
                                    .creationDateTime(LocalDateTime.now())
                                    .updateDateTime(LocalDateTime.now())
                                    .build()
                    )
                    .id(1)
                    .revision(2)
                    .namespace(namespace)
                    .build();
            when(mockAdrStore.updateAdrForNamespace(any(Adr.class))).thenReturn(adr);
        }

        given()
                .header("Content-Type", "application/json")
                .body(adrJson)
                .when()
                .post("/calm/namespaces/" + namespace +"/adrs/1")
                .then()
                .statusCode(expectedStatusCode);

        Adr expectedAdr = AdrBuilder.builder()
                .adrContent(
                        AdrContentBuilder.builder()
                                .title("My ADR")
                                .build())
                .id(1)
                .namespace(namespace)
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
    void respond_correctly_to_get_adr(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        Adr adr = AdrBuilder.builder()
                .namespace(namespace)
                .id(12)
                .revision(2)
                .adrContent(AdrContentBuilder.builder().title("My title").build())
                .build();

        if (exceptionToThrow != null) {
            when(mockAdrStore.getAdr(any(Adr.class))).thenThrow(exceptionToThrow);
        } else {
            when(mockAdrStore.getAdr(any(Adr.class))).thenReturn(adr);
        }

        if (expectedStatusCode == 200) {
            Adr actualAdr = given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12")
                    .then()
                    .statusCode(expectedStatusCode)
                    .extract()
                    .body()
                    .as(Adr.class);
            assertEquals(adr, actualAdr);
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

    private void verifyExpectedGetAdr(String namespace) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, JsonProcessingException {
        Adr expectedAdrToRetrieve = AdrBuilder.builder()
                .namespace(namespace)
                .id(12)
                .build();

        verify(mockAdrStore, times(1)).getAdr(expectedAdrToRetrieve);
    }

}
