package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrPersistenceException;
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
    private final AdrMeta SIMPLE_ADR_META = new AdrMeta.AdrMetaBuilder()
            .setAdr(
                    new Adr.AdrBuilder()
                            .setTitle("My ADR")
                            .setStatus(Status.draft)
                            .setCreationDateTime(LocalDateTime.now())
                            .setUpdateDateTime(LocalDateTime.now())
                            .build()
            )
            .setId(12)
            .setRevision(1)
            .setNamespace("finos")
            .build();

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
                Arguments.of("invalid", new AdrParseException(), 500, nullValue()),
                Arguments.of("valid", null, 201, containsString("/calm/namespaces/valid/adrs/12/revisions/1"))
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreateAdrTests")
    void respond_correctly_when_creating_adr(String namespace, Throwable exceptionToThrow, int expectedStatusCode, Matcher<?> locationHeader) throws NamespaceNotFoundException, AdrParseException {
        if (exceptionToThrow != null) {
            when(mockAdrStore.createAdrForNamespace(any(AdrMeta.class))).thenThrow(exceptionToThrow);
        } else {
            AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder(SIMPLE_ADR_META).setNamespace(namespace).build();
            when(mockAdrStore.createAdrForNamespace(any(AdrMeta.class))).thenReturn(adrMeta);
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

        AdrMeta expectedAdrMeta = new AdrMeta.AdrMetaBuilder()
                .setAdr(
                        new Adr.AdrBuilder()
                                .setTitle("My ADR")
                                .setStatus(Status.draft)
                                .build())
                .setRevision(1)
                .setNamespace(namespace)
                .build();

        verify(mockAdrStore, times(1)).createAdrForNamespace(expectedAdrMeta);
    }

//    //Update ADR Tests

    static Stream<Arguments> provideParametersForUpdateAdrTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new AdrNotFoundException(), 404),
                Arguments.of("valid", new AdrRevisionNotFoundException(), 404),
                Arguments.of("valid", new AdrParseException(), 500),
                Arguments.of("valid", new AdrPersistenceException(), 500),
                Arguments.of("valid", null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForUpdateAdrTests")
    void respond_correctly_to_update_adr(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException {
        String adrJson = "{ \"title\": \"My ADR\" }";
        if (exceptionToThrow != null) {
            when(mockAdrStore.updateAdrForNamespace(any(AdrMeta.class))).thenThrow(exceptionToThrow);
        } else {
            AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                    .setAdr(
                            new Adr.AdrBuilder()
                                    .setTitle("My ADR")
                                    .setStatus(Status.draft)
                                    .setCreationDateTime(LocalDateTime.now())
                                    .setUpdateDateTime(LocalDateTime.now())
                                    .build()
                    )
                    .setId(1)
                    .setRevision(2)
                    .setNamespace(namespace)
                    .build();
            when(mockAdrStore.updateAdrForNamespace(any(AdrMeta.class))).thenReturn(adrMeta);
        }

        given()
                .header("Content-Type", "application/json")
                .body(adrJson)
                .when()
                .post("/calm/namespaces/" + namespace +"/adrs/1")
                .then()
                .statusCode(expectedStatusCode);

        AdrMeta expectedAdrMeta = new AdrMeta.AdrMetaBuilder()
                .setAdr(
                        new Adr.AdrBuilder()
                                .setTitle("My ADR")
                                .build())
                .setId(1)
                .setNamespace(namespace)
                .build();

        verify(mockAdrStore, times(1)).updateAdrForNamespace(expectedAdrMeta);
    }

    static Stream<Arguments> provideParametersForAdrRevisionTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new AdrNotFoundException(), 404),
                Arguments.of("valid", new AdrRevisionNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForAdrRevisionTests")
    void respond_correctly_to_get_adr_revisions_query(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        var revisions = List.of(1, 2);
        if (exceptionToThrow != null) {
            when(mockAdrStore.getAdrRevisions(any(AdrMeta.class))).thenThrow(exceptionToThrow);
        } else {
            when(mockAdrStore.getAdrRevisions(any(AdrMeta.class))).thenReturn(revisions);
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

    private void verifyExpectedAdrRevisions(String namespace) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        AdrMeta expectedAdrToRetrieveMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(12)
                .build();

        verify(mockAdrStore, times(1)).getAdrRevisions(expectedAdrToRetrieveMeta);
    }


    static Stream<Arguments> provideParametersForGetAdrRevisionTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new AdrNotFoundException(), 404),
                Arguments.of("valid", new AdrRevisionNotFoundException(), 404),
                Arguments.of("valid", new AdrParseException(), 500),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetAdrRevisionTests")
    void respond_correctly_to_get_adr_revision(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(12)
                .setRevision(1)
                .setAdr(new Adr.AdrBuilder().setTitle("My title").build())
                .build();

        if (exceptionToThrow != null) {
            when(mockAdrStore.getAdrRevision(any(AdrMeta.class))).thenThrow(exceptionToThrow);
        } else {
            when(mockAdrStore.getAdrRevision(any(AdrMeta.class))).thenReturn(adrMeta);
        }

        if (expectedStatusCode == 200) {
            AdrMeta actualAdrMeta = given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12/revisions/1")
                    .then()
                    .statusCode(expectedStatusCode)
                    .extract()
                    .body()
                    .as(AdrMeta.class);

            assertEquals(adrMeta, actualAdrMeta);
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
    void respond_correctly_to_get_adr(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(12)
                .setRevision(2)
                .setAdr(new Adr.AdrBuilder().setTitle("My title").build())
                .build();

        if (exceptionToThrow != null) {
            when(mockAdrStore.getAdr(any(AdrMeta.class))).thenThrow(exceptionToThrow);
        } else {
            when(mockAdrStore.getAdr(any(AdrMeta.class))).thenReturn(adrMeta);
        }

        if (expectedStatusCode == 200) {
            AdrMeta actualAdrMeta = given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12")
                    .then()
                    .statusCode(expectedStatusCode)
                    .extract()
                    .body()
                    .as(AdrMeta.class);
            assertEquals(adrMeta, actualAdrMeta);
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/adrs/12")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verifyExpectedGetAdr(namespace);
    }

    // Update ADR Status tests

    static Stream<Arguments> provideParametersForUpdateAdrStatusTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new AdrNotFoundException(), 404),
                Arguments.of("valid", new AdrRevisionNotFoundException(), 404),
                Arguments.of("valid", new AdrParseException(), 500),
                Arguments.of("valid", new AdrPersistenceException(), 500),
                Arguments.of("valid", null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForUpdateAdrStatusTests")
    void respond_correctly_on_update_adr_status(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException {
        String adrJson = "{ \"title\": \"My ADR\" }";
        if (exceptionToThrow != null) {
            when(mockAdrStore.updateAdrStatus(any(AdrMeta.class), any(Status.class))).thenThrow(exceptionToThrow);
        } else {
            AdrMeta adrMeta = new AdrMeta.AdrMetaBuilder()
                    .setAdr(
                            new Adr.AdrBuilder()
                                    .setTitle("My ADR")
                                    .setStatus(Status.proposed)
                                    .setCreationDateTime(LocalDateTime.now())
                                    .setUpdateDateTime(LocalDateTime.now())
                                    .build()
                    )
                    .setId(1)
                    .setRevision(2)
                    .setNamespace(namespace)
                    .build();
            when(mockAdrStore.updateAdrStatus(any(AdrMeta.class), any(Status.class))).thenReturn(adrMeta);
        }

        given()
                .header("Content-Type", "application/json")
                .body(adrJson)
                .when()
                .post("/calm/namespaces/" + namespace +"/adrs/1/status/proposed")
                .then()
                .statusCode(expectedStatusCode);

        AdrMeta expectedAdrMeta = new AdrMeta.AdrMetaBuilder()
                .setId(1)
                .setNamespace(namespace)
                .build();

        verify(mockAdrStore, times(1)).updateAdrStatus(expectedAdrMeta, Status.proposed);
    }

    private void verifyExpectedGetAdrRevision(String namespace) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        AdrMeta expectedAdrToRetrieveMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(12)
                .setRevision(1)
                .build();

        verify(mockAdrStore, times(1)).getAdrRevision(expectedAdrToRetrieveMeta);
    }

    private void verifyExpectedGetAdr(String namespace) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        AdrMeta expectedAdrToRetrieveMeta = new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(12)
                .build();

        verify(mockAdrStore, times(1)).getAdr(expectedAdrToRetrieveMeta);
    }

}
