package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestArchitectureResourceShould {

    @InjectMock
    ArchitectureStore mockArchitectureStore;

    @Test
    void return_a_404_when_an_invalid_namespace_is_provided_on_get_architectures() throws NamespaceNotFoundException {
        when(mockArchitectureStore.getArchitecturesForNamespace(anyString())).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/invalid/architectures")
                .then()
                .statusCode(404);

        verify(mockArchitectureStore, times(1)).getArchitecturesForNamespace("invalid");
    }

    @Test
    void return_list_of_architecture_ids_when_valid_namespace_provided_on_get_architectures() throws NamespaceNotFoundException {
        when(mockArchitectureStore.getArchitecturesForNamespace(anyString())).thenReturn(Arrays.asList(12345,54321));

        given()
                .when()
                .get("/calm/namespaces/finos/architectures")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[12345,54321]}"));

        verify(mockArchitectureStore, times(1)).getArchitecturesForNamespace("finos");
    }

    @Test
    void return_a_404_when_invalid_namespace_is_provided_on_create_architecture() throws NamespaceNotFoundException {
        when(mockArchitectureStore.createArchitectureForNamespace(any(Architecture.class)))
                .thenThrow(new NamespaceNotFoundException());

        String architecture = "{ \"test\": \"json\" }";

        given()
                .header("Content-Type", "application/json")
                .body(architecture)
                .when()
                .post("/calm/namespaces/invalid/architectures")
                .then()
                .statusCode(404);

        Architecture expectedArchitecture = new Architecture.ArchitectureBuilder()
                .setArchitecture(architecture)
                .setNamespace("invalid")
                .build();

        verify(mockArchitectureStore, times(1)).createArchitectureForNamespace(expectedArchitecture);
    }

//    //FIXME add a test to catch a JSONParseException and create a 400 response

    @Test
    void return_a_created_with_location_of_architecture_when_creating_architecture() throws NamespaceNotFoundException {
        String architectureJson = "{ \"test\": \"json\" }";
        String namespace = "finos";

        Architecture stubbedReturnArchitecture = new Architecture.ArchitectureBuilder()
                .setArchitecture(architectureJson)
                .setVersion("1.0.0")
                .setId(12)
                .setNamespace(namespace)
                .build();

        when(mockArchitectureStore.createArchitectureForNamespace(any(Architecture.class))).thenReturn(stubbedReturnArchitecture);

        given()
                .header("Content-Type", "application/json")
                .body(architectureJson)
                .when()
                .post("/calm/namespaces/finos/architectures")
                .then()
                .statusCode(201)
                //Derived from stubbed architecture in resource
                .header("Location", containsString("/calm/namespaces/finos/architectures/12/versions/1.0.0"));

        Architecture expectedArchitectureToCreate = new Architecture.ArchitectureBuilder()
                .setArchitecture(architectureJson)
                .setNamespace(namespace)
                .build();

        verify(mockArchitectureStore, times(1)).createArchitectureForNamespace(expectedArchitectureToCreate);
    }

    private void verifyExpectedArchitectureForVersions(String namespace) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        Architecture expectedArchitectureToRetrieve = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(12)
                .build();

        verify(mockArchitectureStore, times(1)).getArchitectureVersions(expectedArchitectureToRetrieve);
    }

    static Stream<Arguments> provideParametersForArchitectureVersionTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new ArchitectureNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForArchitectureVersionTests")
    void respond_correctly_to_get_architecture_versions_query(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws ArchitectureNotFoundException, NamespaceNotFoundException {
        var versions = List.of("1.0.0", "1.0.1");
        if (exceptionToThrow != null) {
            when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenThrow(exceptionToThrow);
        } else {
            when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(versions);
        }

        if (expectedStatusCode == 200 ) {
            String expectedBody = "{\"values\":[\"1.0.0\",\"1.0.1\"]}";
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/architectures/12/versions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo(expectedBody));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/architectures/12/versions")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verifyExpectedArchitectureForVersions(namespace);
    }

    private void verifyExpectedGetArchitecture(String namespace) throws ArchitectureNotFoundException, NamespaceNotFoundException, ArchitectureVersionNotFoundException {
        Architecture expectedArchitectureToRetrieve = new Architecture.ArchitectureBuilder()
                .setNamespace(namespace)
                .setId(12)
                .setVersion("1.0.0")
                .build();

        verify(mockArchitectureStore, times(1)).getArchitectureForVersion(expectedArchitectureToRetrieve);
    }

    static Stream<Arguments> provideParametersForGetArchitectureTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new ArchitectureNotFoundException(), 404),
                Arguments.of("valid", new ArchitectureVersionNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetArchitectureTests")
    void respond_correctly_to_get_architecture_for_a_specific_version_correctly(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws ArchitectureVersionNotFoundException, ArchitectureNotFoundException, NamespaceNotFoundException {
        if (exceptionToThrow != null) {
            when(mockArchitectureStore.getArchitectureForVersion(any(Architecture.class))).thenThrow(exceptionToThrow);
        } else {
            String architecture = "{ \"test\": \"json\" }";
            when(mockArchitectureStore.getArchitectureForVersion(any(Architecture.class))).thenReturn(architecture);
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/architectures/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo("{ \"test\": \"json\" }"));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/architectures/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verifyExpectedGetArchitecture(namespace);
    }

    static Stream<Arguments> provideParametersForCreateArchitectureTests() {
        return Stream.of(
                Arguments.of( new NamespaceNotFoundException(), 404),
                Arguments.of( new ArchitectureNotFoundException(), 404),
                Arguments.of(new ArchitectureVersionExistsException(), 409),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreateArchitectureTests")
    void respond_correctly_to_create_architecture(Throwable exceptionToThrow, int expectedStatusCode) throws ArchitectureNotFoundException, ArchitectureVersionExistsException, NamespaceNotFoundException {
        Architecture expectedArchitecture = new Architecture.ArchitectureBuilder()
                .setNamespace("test")
                .setVersion("1.0.1")
                .setArchitecture("{ \"test\": \"json\" }")
                .setId(20)
                .build();

        if (exceptionToThrow != null) {
            when(mockArchitectureStore.createArchitectureForVersion(expectedArchitecture)).thenThrow(exceptionToThrow);
        } else {
            when(mockArchitectureStore.createArchitectureForVersion(expectedArchitecture)).thenReturn(expectedArchitecture);
        }

        if(expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body(expectedArchitecture.getArchitectureJson())
                    .when()
                    .post("/calm/namespaces/test/architectures/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    //Derived from stubbed architecture in resource
                    .header("Location", containsString("/calm/namespaces/test/architectures/20/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body(expectedArchitecture.getArchitectureJson())
                    .when()
                    .post("/calm/namespaces/test/architectures/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockArchitectureStore, times(1)).createArchitectureForVersion(expectedArchitecture);
    }

    @Test
    void return_forbidden_for_put_operations_on_architectures_default_and_when_configured() {
        given()
                .header("Content-Type", "application/json")
                .body("{ \"test\": \"json\" }")
                .when()
                .put("/calm/namespaces/test/architectures/20/versions/1.0.1")
                .then()
                .statusCode(403);
    }
}
