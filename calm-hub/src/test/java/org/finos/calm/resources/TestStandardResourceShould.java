package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.standards.NamespaceStandardSummary;
import org.finos.calm.store.StandardStore;
import org.hamcrest.core.IsEqual;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

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
public class TestStandardResourceShould {

    @InjectMock
    StandardStore mockStandardStore;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private NamespaceStandardSummary nistStandardSummary;
    private NamespaceStandardSummary finosStandardSummary;

    @BeforeEach
    void beforeEach() {
        nistStandardSummary = new NamespaceStandardSummary("nist", "NIST Standard",1);
        finosStandardSummary = new NamespaceStandardSummary("finos", "FINOS Standard", 2);
    }

    @Test
    void return_a_404_when_a_namespace_is_provided_that_does_not_exist_on_get_standards() throws NamespaceNotFoundException {
        when(mockStandardStore.getStandardsForNamespace(anyString())).thenThrow(new NamespaceNotFoundException());

        given()
            .when()
            .get("/calm/namespaces/invalid/standards")
            .then()
            .statusCode(404);

        verify(mockStandardStore).getStandardsForNamespace("invalid");
    }

    @Test
    void return_a_400_when_an_invalid_namespace_is_provided_on_get_standards() {
        given()
                .when()
                .get("/calm/namespaces/$$$$$/standards")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_list_of_standards_response_when_valid_namespace_provided_on_get_standards() throws NamespaceNotFoundException, JsonProcessingException {
        List<NamespaceStandardSummary> expectedStandardSummary = List.of(this.nistStandardSummary, this.finosStandardSummary);

        when(mockStandardStore.getStandardsForNamespace("valid")).thenReturn(expectedStandardSummary);

        given()
                .when()
                .get("/calm/namespaces/valid/standards")
                .then()
                .statusCode(200)
                .body("values[0].name", equalTo("nist"))
                .body("values[0].description", equalTo("NIST Standard"))
                .body("values[1].name", equalTo("finos"))
                .body("values[1].description", equalTo("FINOS Standard"));

        verify(mockStandardStore).getStandardsForNamespace("valid");
    }

    @Test
    void return_a_404_when_namespace_is_provided_that_does_not_exist_on_create_standards() throws NamespaceNotFoundException, JsonProcessingException {
        when(mockStandardStore.createStandardForNamespace(any(CreateStandardRequest.class), eq("invalid"))).thenThrow(new NamespaceNotFoundException());
        CreateStandardRequest createStandardRequest = new CreateStandardRequest();
        createStandardRequest.setName("nist");
        createStandardRequest.setDescription("NIST Standard");
        createStandardRequest.setStandardJson("{}");

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createStandardRequest))
                .when()
                .post("/calm/namespaces/invalid/standards")
                .then()
                .statusCode(404);

        verify(mockStandardStore).createStandardForNamespace(createStandardRequest, "invalid");
    }

    @Test
    void return_a_400_when_invalid_namespace_is_provided_on_create_standards() throws JsonProcessingException {
        CreateStandardRequest createStandardRequest = new CreateStandardRequest();
        createStandardRequest.setName("nist");
        createStandardRequest.setDescription("NIST Standard");
        createStandardRequest.setStandardJson("{}");

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createStandardRequest))
                .when()
                .post("/calm/namespaces/$$$$$/standards")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_a_created_status_code_with_location_of_standard_when_creating_a_standard() throws NamespaceNotFoundException, JsonProcessingException {
        Standard storedNist = new Standard("nist", "NIST Standard", "{ \"test\": \"json\" }", 5, "1.0.0");
        CreateStandardRequest createStandardRequest = new CreateStandardRequest();
        createStandardRequest.setName("nist");
        createStandardRequest.setDescription("NIST Standard");
        createStandardRequest.setStandardJson("{ \"test\": \"json\" }");
        when(mockStandardStore.createStandardForNamespace(createStandardRequest, "valid")).thenReturn(storedNist);

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createStandardRequest))
                .when()
                .post("/calm/namespaces/valid/standards")
                .then()
                .statusCode(201)
                .header("Location",  containsString(("/calm/namespaces/valid/standards/5/versions/1.0.0")));

        verify(mockStandardStore).createStandardForNamespace(createStandardRequest, "valid");
    }

    @Test
    void return_400_when_invalid_namespace_provided_when_getting_versions_of_standard() {
        given()
                .when()
                .get("/calm/namespaces/$$$$$/standards/5/versions")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    static Stream<Arguments> provideParametersForStandardVersionTests() {
        return Stream.of(
            Arguments.of("invalid", new NamespaceNotFoundException(), 404, "Invalid namespace provided"),
            Arguments.of("valid", new StandardNotFoundException(), 404, "Invalid standard provided"),
            Arguments.of("valid", null, 200, "{\"values\":[\"1.0.0\",\"1.0.1\"]}")
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForStandardVersionTests")
    void respond_correctly_to_get_standard_versions_query(String namespace, Throwable exceptionToThrow, int expectedStatusCode, String expectedBody) throws StandardNotFoundException, NamespaceNotFoundException {

        if(exceptionToThrow != null) {
            when(mockStandardStore.getStandardVersions(namespace,5)).thenThrow(exceptionToThrow);
        } else {
            when(mockStandardStore.getStandardVersions(namespace, 5)).thenReturn(List.of("1.0.0", "1.0.1"));
        }

        if(expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/standards/5/versions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo(expectedBody));
        } else {
            given()
                .when()
                .get("/calm/namespaces/" + namespace + "/standards/5/versions")
                .then()
                .statusCode(expectedStatusCode)
                .body(containsString(expectedBody));
        }

        verify(mockStandardStore).getStandardVersions(namespace, 5);
    }

    @Test
    void return_400_when_invalid_namespace_provided_when_getting_version_of_standard() {
        given()
                .when()
                .get("/calm/namespaces/$$$$/standards/5/versions/1.0.0")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_400_when_invalid_version_provided_when_getting_version_of_standard() {
        given()
                .when()
                .get("/calm/namespaces/finos/standards/5/versions/invalid_version")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForGetStandardTests() {
        return Stream.of(
          Arguments.of("invalid", new NamespaceNotFoundException(), 404),
          Arguments.of("valid", new StandardNotFoundException(), 404),
          Arguments.of("valid", new StandardVersionNotFoundException(), 404),
          Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetStandardTests")
    void respond_to_get_standard_for_a_specific_version_correctly(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws StandardNotFoundException, StandardVersionNotFoundException, NamespaceNotFoundException, JsonProcessingException {
        Standard standard = new Standard();
        standard.setNamespace(namespace);
        standard.setId(5);
        standard.setStandardJson("{}");

        if(exceptionToThrow != null) {
            when(mockStandardStore.getStandardForVersion(namespace, 5, "1.0.0")).thenThrow(exceptionToThrow);
        } else {
            standard.setStandardJson(objectMapper.writeValueAsString(standard));
            when(mockStandardStore.getStandardForVersion(namespace, 5, "1.0.0")).thenReturn("{}");
        }

        if(expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/standards/5/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo("{}"));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/standards/5/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }
    }

    @Test
    void return_400_when_invalid_namespace_provided_when_creating_new_version_of_standard() {
        CreateStandardRequest createStandardRequest = new CreateStandardRequest();
        createStandardRequest.setName("amazing-standard");
        createStandardRequest.setDescription("An amazing standard");
        createStandardRequest.setStandardJson("{}");

        given()
                .header("Content-Type", "application/json")
                .body(createStandardRequest)
                .when()
                .post("/calm/namespaces/$$$$/standards/5/versions/1.0.1")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_400_when_invalid_version_provided_when_creating_new_version_of_standard() {
        CreateStandardRequest createStandardRequest = new CreateStandardRequest();
        createStandardRequest.setName("amazing-standard");
        createStandardRequest.setDescription("An amazing standard");
        createStandardRequest.setStandardJson("{}");

        given()
                .header("Content-Type", "application/json")
                .body(createStandardRequest)
                .when()
                .post("/calm/namespaces/finos/standards/5/versions/invalid-version")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForCreateStandardTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new StandardNotFoundException(), 404),
                Arguments.of("valid", new StandardVersionExistsException(), 409),
                Arguments.of("valid", null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreateStandardTests")
    void respond_correctly_to_create_standards(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws StandardNotFoundException, StandardVersionNotFoundException, NamespaceNotFoundException, StandardVersionExistsException {
        CreateStandardRequest createStandardRequest = new CreateStandardRequest();
        createStandardRequest.setName("amazing-standard");
        createStandardRequest.setDescription("An amazing standard");
        createStandardRequest.setStandardJson("{}");

        if (exceptionToThrow != null) {
            when(mockStandardStore.createStandardForVersion(createStandardRequest, namespace, 5, "1.0.1")).thenThrow(exceptionToThrow);
        } else {
            Standard createdStandard = new Standard(createStandardRequest);
            createdStandard.setId(5);
            createdStandard.setNamespace(namespace);
            createdStandard.setVersion("1.0.1");
            when(mockStandardStore.createStandardForVersion(createStandardRequest, namespace, 5, "1.0.1")).thenReturn(createdStandard);
        }

        if(expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body(createStandardRequest)
                    .when()
                    .post("/calm/namespaces/" + namespace + "/standards/5/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    //Derived from stubbed standard in resource
                    .header("Location", containsString("/calm/namespaces/valid/standards/5/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body(createStandardRequest)
                    .when()
                    .post("/calm/namespaces/" + namespace + "/standards/5/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockStandardStore, times(1)).createStandardForVersion(createStandardRequest, namespace, 5, "1.0.1");
    }
}
