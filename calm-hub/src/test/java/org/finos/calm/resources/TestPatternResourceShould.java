package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.store.PatternStore;
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
public class TestPatternResourceShould {

    @InjectMock
    PatternStore mockPatternStore;

    @Test
    void return_a_404_when_an_invalid_namespace_is_provided_on_get_patterns() throws NamespaceNotFoundException {
        when(mockPatternStore.getPatternsForNamespace(anyString())).thenThrow(NamespaceNotFoundException.class);

        given()
                .when()
                .get("/calm/namespaces/invalid/patterns")
                .then()
                .statusCode(404);

        verify(mockPatternStore, times(1)).getPatternsForNamespace("invalid");
    }

    @Test
    void return_list_of_pattern_ids_when_valid_namespace_provided_on_get_patterns() throws NamespaceNotFoundException {
        when(mockPatternStore.getPatternsForNamespace(anyString())).thenReturn(Arrays.asList(12345,54321));

        given()
                .when()
                .get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[12345,54321]}"));

        verify(mockPatternStore, times(1)).getPatternsForNamespace("finos");
    }

    @Test
    void return_a_404_when_invalid_namespace_is_provided_on_create_pattern() throws NamespaceNotFoundException {
        when(mockPatternStore.createPatternForNamespace(any(Pattern.class)))
                .thenThrow(NamespaceNotFoundException.class);

        String pattern = "{ \"test\": \"json\" }";

        given()
                .header("Content-Type", "application/json")
                .body(pattern)
                .when()
                .post("/calm/namespaces/invalid/patterns")
                .then()
                .statusCode(404);

        Pattern expectedPattern = new Pattern.PatternBuilder()
                .setPattern(pattern)
                .setNamespace("invalid")
                .build();

        verify(mockPatternStore, times(1)).createPatternForNamespace(expectedPattern);
    }

    //FIXME add a test to catch a JSONParseException and create a 400 response

    @Test
    void return_a_created_with_location_of_pattern_when_creating_pattern() throws NamespaceNotFoundException {
        String patternJson = "{ \"test\": \"json\" }";
        String namespace = "finos";

        Pattern stubbedReturnPattern = new Pattern.PatternBuilder()
                .setPattern(patternJson)
                .setVersion("1.0.0")
                .setId(12)
                .setNamespace(namespace)
                .build();

        when(mockPatternStore.createPatternForNamespace(any(Pattern.class))).thenReturn(stubbedReturnPattern);

        given()
                .header("Content-Type", "application/json")
                .body(patternJson)
                .when()
                .post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(201)
                //Derived from stubbed pattern in resource
                .header("Location", containsString("/calm/namespaces/finos/patterns/12/versions/1.0.0"));

        Pattern expectedPatternToCreate = new Pattern.PatternBuilder()
                .setPattern(patternJson)
                .setNamespace(namespace)
                .build();

        verify(mockPatternStore, times(1)).createPatternForNamespace(expectedPatternToCreate);
    }

    private void verifyExpectedPatternForVersions(String namespace) throws PatternNotFoundException, NamespaceNotFoundException {
        Pattern expectedPatternToRetrieve = new Pattern.PatternBuilder()
                .setNamespace(namespace)
                .setId(12)
                .build();

        verify(mockPatternStore, times(1)).getPatternVersions(expectedPatternToRetrieve);
    }

    static Stream<Arguments> provideParametersForPatternVersionTests() {
        return Stream.of(
                Arguments.of("invalid", NamespaceNotFoundException.class, 404),
                Arguments.of("valid", PatternNotFoundException.class, 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForPatternVersionTests")
    void respond_correctly_to_get_pattern_versions_query(String namespace, Class<? extends Exception> exceptionToThrow, int expectedStatusCode) throws PatternNotFoundException, NamespaceNotFoundException {
        var versions = List.of("1.0.0", "1.0.1");
        if (exceptionToThrow != null) {
            when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(exceptionToThrow);
        } else {
            when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(versions);
        }

        if (expectedStatusCode == 200 ) {
            String expectedBody = "{\"values\":[\"1.0.0\",\"1.0.1\"]}";
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/patterns/12/versions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo(expectedBody));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/patterns/12/versions")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verifyExpectedPatternForVersions(namespace);
    }

    private void verifyExpectedGetPattern(String namespace) throws PatternNotFoundException, NamespaceNotFoundException, PatternVersionNotFoundException {
        Pattern expectedPatternToRetrieve = new Pattern.PatternBuilder()
                .setNamespace(namespace)
                .setId(12)
                .setVersion("1.0.0")
                .build();

        verify(mockPatternStore, times(1)).getPatternForVersion(expectedPatternToRetrieve);
    }

    static Stream<Arguments> provideParametersForGetPatternTests() {
        return Stream.of(
                Arguments.of("invalid", NamespaceNotFoundException.class, 404),
                Arguments.of("valid", PatternNotFoundException.class, 404),
                Arguments.of("valid", PatternVersionNotFoundException.class, 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetPatternTests")
    void respond_correct_to_get_pattern_for_a_specific_version_correctly(String namespace, Class<? extends Exception> exceptionToThrow, int expectedStatusCode) throws PatternNotFoundException, NamespaceNotFoundException, PatternVersionNotFoundException {
        if (exceptionToThrow != null) {
            when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(exceptionToThrow);
        } else {
            String pattern = "{ \"test\": \"json\" }";
            when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn(pattern);
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/patterns/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo("{ \"test\": \"json\" }"));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/patterns/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verifyExpectedGetPattern(namespace);
    }

    static Stream<Arguments> provideParametersForCreatePatternTests() {
        return Stream.of(
                Arguments.of( NamespaceNotFoundException.class, 404),
                Arguments.of( PatternNotFoundException.class, 404),
                Arguments.of(PatternVersionExistsException.class, 409),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreatePatternTests")
    void respond_correctly_to_create_pattern_correctly(Class<? extends Exception> exceptionToThrow, int expectedStatusCode) throws PatternNotFoundException, PatternVersionExistsException, NamespaceNotFoundException {
        Pattern expectedPattern = new Pattern.PatternBuilder()
                .setNamespace("test")
                .setVersion("1.0.1")
                .setPattern("{ \"test\": \"json\" }")
                .setId(20)
                .build();

        System.out.println("TestPatternResourceShould mock: " + mockPatternStore);

        if (exceptionToThrow != null) {
            when(mockPatternStore.createPatternForVersion(expectedPattern)).thenThrow(exceptionToThrow);
        } else {
            when(mockPatternStore.createPatternForVersion(expectedPattern)).thenReturn(expectedPattern);
        }

        if(expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body(expectedPattern.getPatternJson())
                    .when()
                    .post("/calm/namespaces/test/patterns/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    //Derived from stubbed pattern in resource
                    .header("Location", containsString("/calm/namespaces/test/patterns/20/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body(expectedPattern.getPatternJson())
                    .when()
                    .post("/calm/namespaces/test/patterns/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockPatternStore, times(1)).createPatternForVersion(expectedPattern);
    }

    @Test
    void return_forbidden_for_put_operations_on_patterns_by_default_and_when_configured() {
        given()
                .header("Content-Type", "application/json")
                .body("{ \"test\": \"json\" }")
                .when()
                .put("/calm/namespaces/test/patterns/20/versions/1.0.1")
                .then()
                .statusCode(403);
    }
}
