package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.patterns.CreatePatternRequest;
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
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestPatternResourceShould {

    @InjectMock
    PatternStore mockPatternStore;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void return_a_404_when_an_invalid_namespace_is_provided_on_get_patterns() throws NamespaceNotFoundException {
        when(mockPatternStore.getPatternsForNamespace(anyString())).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/invalid/patterns")
                .then()
                .statusCode(404);

        verify(mockPatternStore, times(1)).getPatternsForNamespace("invalid");
    }

    @Test
    void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_get_patterns() throws NamespaceNotFoundException {
        given()
                .when()
                .get("/calm/namespaces/fin_os/patterns")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_list_of_pattern_ids_when_valid_namespace_provided_on_get_patterns() throws NamespaceNotFoundException {
        when(mockPatternStore.getPatternsForNamespace(anyString())).thenReturn(Arrays.asList(12345, 54321));

        given()
                .when()
                .get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[12345,54321]}"));

        verify(mockPatternStore, times(1)).getPatternsForNamespace("finos");
    }

    @Test
    void return_a_404_when_invalid_namespace_is_provided_on_create_pattern() throws NamespaceNotFoundException, JsonProcessingException {
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("invalid")))
                .thenThrow(new NamespaceNotFoundException());

        CreatePatternRequest createPatternRequest = new CreatePatternRequest();
        createPatternRequest.setName("test-name");
        createPatternRequest.setDescription("test description");
        createPatternRequest.setPatternJson("{ \"test\": \"json\" }");

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createPatternRequest))
                .when()
                .post("/calm/namespaces/invalid/patterns")
                .then()
                .statusCode(404);

        verify(mockPatternStore, times(1)).createPatternForNamespace(createPatternRequest, "invalid");
    }

    @Test
    void return_a_400_when_invalid_pattern_json_is_provided_on_create_pattern() throws NamespaceNotFoundException {
        when(mockPatternStore.createPatternForNamespace(any(Pattern.class)))
                .thenThrow(new JsonParseException());

        CreatePatternRequest createPatternRequest = new CreatePatternRequest();
        createPatternRequest.setName("test-name");
        createPatternRequest.setDescription("test description");
        createPatternRequest.setPatternJson("{ \"test\": this is invalid json");

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createPatternRequest))
                .when()
                .post("/calm/namespaces/invalid/patterns")
                .then()
                .statusCode(400);

        verify(mockPatternStore, times(1)).createPatternForNamespace(createPatternRequest, "invalid");
    }

    @Test
    void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_create_pattern() throws NamespaceNotFoundException {

        CreatePatternRequest createPatternRequest = new CreatePatternRequest();
        createPatternRequest.setName("test-name");
        createPatternRequest.setDescription("test description");
        createPatternRequest.setPatternJson("{ \"test\": this is invalid json");

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createPatternRequest))
                .when()
                .post("/calm/namespaces/invalid_/patterns")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_a_created_with_location_of_pattern_when_creating_pattern() throws NamespaceNotFoundException {
        String storedPattern = new Pattern("test-name", "test description", "{ \"test\": \"json\" }", 12, "1.0.0");

        CreatePatternRequest createPatternRequest = new CreatePatternRequest();
        createPatternRequest.setName("test-name");
        createPatternRequest.setDescription("test description");
        createPatternRequest.setPatternJson("{ \"test\": \"json\" }");
        when(mockPatternStore.createPatternForNamespace(createPatternRequest, "valid")).thenReturn(storedPattern);

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createPatternRequest))
                .when()
                .post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(201)
                //Derived from stubbed pattern in resource
                .header("Location", containsString("/calm/namespaces/finos/patterns/12/versions/1.0.0"));

        verify(mockPatternStore, times(1)).createPatternForNamespace(createPatternRequest, "finos");
    }

    @Test
    void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_get_pattern_versions() throws NamespaceNotFoundException {
        given()
                .when()
                .get("/calm/namespaces/fin_os/patterns/12/versions")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    private void verifyExpectedPatternForVersions(String namespace, Integer patternId) throws PatternNotFoundException, NamespaceNotFoundException {
        verify(mockPatternStore, times(1)).getPatternVersions(namespace, patternId);
    }

    static Stream<Arguments> provideParametersForPatternVersionTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new PatternNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForPatternVersionTests")
    void respond_correctly_to_get_pattern_versions_query(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws PatternNotFoundException, NamespaceNotFoundException {
        var versions = List.of("1.0.0", "1.0.1");
        if (exceptionToThrow != null) {
            when(mockPatternStore.getPatternVersions(namespace, 12)).thenThrow(exceptionToThrow);
        } else {
            when(mockPatternStore.getPatternVersions(namespace, 12)).thenReturn(versions);
        }

        if (expectedStatusCode == 200) {
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

        verifyExpectedPatternForVersions(namespace, patternId);
    }

    @Test
    void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_get_pattern() throws NamespaceNotFoundException {
        given()
                .when()
                .get("/calm/namespaces/fin_os/patterns/12/versions/1.0.0")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_a_400_when_an_invalid_format_of_version_is_provided_on_get_pattern() throws NamespaceNotFoundException {
        given()
                .when()
                .get("/calm/namespaces/finos/patterns/12/versions/1.0.invalid0")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    private void verifyExpectedGetPattern(String namespace, Integer patternId, String version) throws PatternNotFoundException, NamespaceNotFoundException, PatternVersionNotFoundException {
        verify(mockPatternStore, times(1)).getPatternForVersion(namespace, patternId, version);
    }

    static Stream<Arguments> provideParametersForGetPatternTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new PatternNotFoundException(), 404),
                Arguments.of("valid", new PatternVersionNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetPatternTests")
    void respond_to_get_pattern_for_a_specific_version_correctly(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws PatternNotFoundException, NamespaceNotFoundException, PatternVersionNotFoundException {
        Pattern pattern = new Pattern();
        pattern.setNamespace(namespace);
        pattern.setId(12);
        pattern.setPatternJson("{ \"test\": \"json\" }");

        if (exceptionToThrow != null) {
            when(mockPatternStore.getPatternForVersion(namespace, 12, "1.0.0")).thenThrow(exceptionToThrow);
        } else {
            when(mockPatternStore.getPatternForVersion(namespace, 12, "1.0.0")).thenReturn(pattern);
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/patterns/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body("namespace", equalTo(namespace))
                    .body("id", equalTo(12))
                    .body("standardJson", containsString("{ \"test\": \"json\" }"));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/patterns/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verifyExpectedGetPattern(namespace, 12, "1.0.0");
    }

    @Test
    void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_create_new_pattern_version() throws NamespaceNotFoundException {
        given()
                .when()
                .header("Content-Type", "application/json")
                .body("{ \"test\": \"json\" }")
                .post("/calm/namespaces/fin_os/patterns/20/versions/1.0.1")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_a_400_when_an_invalid_format_of_version_is_provided_on_create_new_pattern_version() throws NamespaceNotFoundException {
        given()
                .when()
                .header("Content-Type", "application/json")
                .body("{ \"test\": \"json\" }")
                .post("/calm/namespaces/finos/patterns/20/versions/1.0invalid.1")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForCreatePatternTests() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404),
                Arguments.of(new PatternNotFoundException(), 404),
                Arguments.of(new PatternVersionExistsException(), 409),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreatePatternTests")
    void respond_correctly_to_create_new_pattern_version(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws PatternNotFoundException, PatternVersionExistsException, NamespaceNotFoundException {
        CreatePatternRequest createPatternRequest = new CreatePatternRequest();
        createPatternRequest.setName("technicolour-pattern");
        createPatternRequest.setDescription("A pattern of many colours");
        createPatternRequest.setPatternJson("{ \"test\": \"json\" }");

        if (exceptionToThrow != null) {
            when(mockPatternStore.createPatternForVersion(createPatternRequest, namespace, 20, "1.0.1")).thenThrow(exceptionToThrow);
        } else {
            Pattern createdPattern = new Pattern(createPatternRequest);
            createdPattern.setId(20);
            createdPattern.setNamespace(namespace);
            createdPattern.setVersion("1.0.1");
            when(mockPatternStore.createPatternForVersion(createdPattern, namespace, 20, "1.0.1")).thenReturn(createdPattern);
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body(createPatternRequest)
                    .when()
                    .post("/calm/namespaces/" + namespace + "/patterns/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    //Derived from stubbed pattern in resource
                    .header("Location", containsString("/calm/namespaces/valid/patterns/20/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body(createPatternRequest)
                    .when()
                    .post("/calm/namespaces/" + namespace + "/patterns/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockPatternStore, times(1)).createPatternForVersion(createPatternRequest, namespace, 20, "1.0.1");
    }

    @Test
    void return_forbidden_for_put_operations_on_patterns_by_default_and_when_configured() {
        CreatePatternRequest createPatternRequest = new CreatePatternRequest();
        createPatternRequest.setName("test-pattern");
        createPatternRequest.setDescription("Test Pattern");
        createPatternRequest.setPatternJson("{ \"test\": \"json\" }");

        given()
                .header("Content-Type", "application/json")
                .body(createPatternRequest)
                .when()
                .put("/calm/namespaces/test/patterns/20/versions/1.0.1")
                .then()
                .statusCode(403);
    }
}
