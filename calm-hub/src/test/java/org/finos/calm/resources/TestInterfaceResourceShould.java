package org.finos.calm.resources;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.stream.Stream;

import org.bson.json.JsonParseException;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.store.InterfaceStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestInterfaceResourceShould {

    @InjectMock
    InterfaceStore mockInterfaceStore;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private NamespaceInterfaceSummary tcpInterfaceSummary;
    private NamespaceInterfaceSummary httpInterfaceSummary;

    @BeforeEach
    void beforeEach() {
        tcpInterfaceSummary = new NamespaceInterfaceSummary("tcp-port", "TCP Port Interface", 1);
        httpInterfaceSummary = new NamespaceInterfaceSummary("http-url", "HTTP URL Interface", 2);
    }

    @Test
    void return_a_404_when_a_namespace_is_provided_that_does_not_exist_on_get_interfaces() throws NamespaceNotFoundException {
        when(mockInterfaceStore.getInterfacesForNamespace(anyString())).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/invalid/interfaces")
                .then()
                .statusCode(404);

        verify(mockInterfaceStore).getInterfacesForNamespace("invalid");
    }

    @Test
    void return_a_400_when_an_invalid_namespace_is_provided_on_get_interfaces() {
        given()
                .when()
                .get("/calm/namespaces/$$$$$/interfaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_list_of_interfaces_response_when_valid_namespace_provided_on_get_interfaces() throws NamespaceNotFoundException {
        List<NamespaceInterfaceSummary> expectedInterfaceSummary = List.of(this.tcpInterfaceSummary, this.httpInterfaceSummary);

        when(mockInterfaceStore.getInterfacesForNamespace("valid")).thenReturn(expectedInterfaceSummary);

        given()
                .when()
                .get("/calm/namespaces/valid/interfaces")
                .then()
                .statusCode(200)
                .body("values[0].name", equalTo("tcp-port"))
                .body("values[0].description", equalTo("TCP Port Interface"))
                .body("values[1].name", equalTo("http-url"))
                .body("values[1].description", equalTo("HTTP URL Interface"));

        verify(mockInterfaceStore).getInterfacesForNamespace("valid");
    }

    @Test
    void return_a_404_when_namespace_is_provided_that_does_not_exist_on_create_interfaces() throws NamespaceNotFoundException, JsonProcessingException {
        when(mockInterfaceStore.createInterfaceForNamespace(any(CreateInterfaceRequest.class), eq("invalid"))).thenThrow(new NamespaceNotFoundException());
        CreateInterfaceRequest createInterfaceRequest = new CreateInterfaceRequest();
        createInterfaceRequest.setName("tcp-port");
        createInterfaceRequest.setDescription("TCP Port Interface");
        createInterfaceRequest.setInterfaceJson("{}");

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createInterfaceRequest))
                .when()
                .post("/calm/namespaces/invalid/interfaces")
                .then()
                .statusCode(404);

        verify(mockInterfaceStore).createInterfaceForNamespace(createInterfaceRequest, "invalid");
    }

    @Test
    void return_a_400_when_invalid_namespace_is_provided_on_create_interfaces() throws JsonProcessingException {
        CreateInterfaceRequest createInterfaceRequest = new CreateInterfaceRequest();
        createInterfaceRequest.setName("tcp-port");
        createInterfaceRequest.setDescription("TCP Port Interface");
        createInterfaceRequest.setInterfaceJson("{}");

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createInterfaceRequest))
                .when()
                .post("/calm/namespaces/$$$$$/interfaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_a_created_status_code_with_location_of_interface_when_creating_an_interface() throws NamespaceNotFoundException, JsonProcessingException {
        CalmInterface storedInterface = new CalmInterface("tcp-port", "TCP Port Interface", "{ \"test\": \"json\" }", 5, "1.0.0");
        CreateInterfaceRequest createInterfaceRequest = new CreateInterfaceRequest();
        createInterfaceRequest.setName("tcp-port");
        createInterfaceRequest.setDescription("TCP Port Interface");
        createInterfaceRequest.setInterfaceJson("{ \"test\": \"json\" }");
        when(mockInterfaceStore.createInterfaceForNamespace(createInterfaceRequest, "valid")).thenReturn(storedInterface);

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createInterfaceRequest))
                .when()
                .post("/calm/namespaces/valid/interfaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/valid/interfaces/5/versions/1.0.0"));

        verify(mockInterfaceStore).createInterfaceForNamespace(createInterfaceRequest, "valid");
    }

    @Test
    void return_a_400_when_invalid_json_is_provided_on_create_interface() throws NamespaceNotFoundException, JsonProcessingException {
        when(mockInterfaceStore.createInterfaceForNamespace(any(CreateInterfaceRequest.class), eq("valid")))
                .thenThrow(new JsonParseException());

        CreateInterfaceRequest createInterfaceRequest = new CreateInterfaceRequest();
        createInterfaceRequest.setName("tcp-port");
        createInterfaceRequest.setDescription("TCP Port Interface");
        createInterfaceRequest.setInterfaceJson("{ invalid json");

        given()
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(createInterfaceRequest))
                .when()
                .post("/calm/namespaces/valid/interfaces")
                .then()
                .statusCode(400);
    }

    @Test
    void return_400_when_invalid_namespace_provided_when_getting_versions_of_interface() {
        given()
                .when()
                .get("/calm/namespaces/$$$$$/interfaces/5/versions")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    static Stream<Arguments> provideParametersForInterfaceVersionTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404, "Invalid namespace provided"),
                Arguments.of("valid", new InterfaceNotFoundException(), 404, "Invalid interface provided"),
                Arguments.of("valid", null, 200, "{\"values\":[\"1.0.0\",\"1.0.1\"]}")
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForInterfaceVersionTests")
    void respond_correctly_to_get_interface_versions_query(String namespace, Throwable exceptionToThrow, int expectedStatusCode, String expectedBody) throws InterfaceNotFoundException, NamespaceNotFoundException {

        if (exceptionToThrow != null) {
            when(mockInterfaceStore.getInterfaceVersions(namespace, 5)).thenThrow(exceptionToThrow);
        } else {
            when(mockInterfaceStore.getInterfaceVersions(namespace, 5)).thenReturn(List.of("1.0.0", "1.0.1"));
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/interfaces/5/versions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo(expectedBody));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/interfaces/5/versions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(containsString(expectedBody));
        }

        verify(mockInterfaceStore).getInterfaceVersions(namespace, 5);
    }

    @Test
    void return_400_when_invalid_namespace_provided_when_getting_version_of_interface() {
        given()
                .when()
                .get("/calm/namespaces/$$$$/interfaces/5/versions/1.0.0")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_400_when_invalid_version_provided_when_getting_version_of_interface() {
        given()
                .when()
                .get("/calm/namespaces/finos/interfaces/5/versions/invalid_version")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForGetInterfaceTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new InterfaceNotFoundException(), 404),
                Arguments.of("valid", new InterfaceVersionNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetInterfaceTests")
    void respond_to_get_interface_for_a_specific_version_correctly(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws InterfaceNotFoundException, InterfaceVersionNotFoundException, NamespaceNotFoundException, JsonProcessingException {
        CalmInterface calmInterface = new CalmInterface();
        calmInterface.setNamespace(namespace);
        calmInterface.setId(5);
        calmInterface.setInterfaceJson("{}");

        if (exceptionToThrow != null) {
            when(mockInterfaceStore.getInterfaceForVersion(namespace, 5, "1.0.0")).thenThrow(exceptionToThrow);
        } else {
            calmInterface.setInterfaceJson(objectMapper.writeValueAsString(calmInterface));
            when(mockInterfaceStore.getInterfaceForVersion(namespace, 5, "1.0.0")).thenReturn("{}");
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/interfaces/5/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo("{}"));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/interfaces/5/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }
    }

    @Test
    void return_400_when_invalid_namespace_provided_when_creating_new_version_of_interface() {
        CreateInterfaceRequest createInterfaceRequest = new CreateInterfaceRequest();
        createInterfaceRequest.setName("amazing-interface");
        createInterfaceRequest.setDescription("An amazing interface");
        createInterfaceRequest.setInterfaceJson("{}");

        given()
                .header("Content-Type", "application/json")
                .body(createInterfaceRequest)
                .when()
                .post("/calm/namespaces/$$$$/interfaces/5/versions/1.0.1")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));
    }

    @Test
    void return_400_when_invalid_version_provided_when_creating_new_version_of_interface() {
        CreateInterfaceRequest createInterfaceRequest = new CreateInterfaceRequest();
        createInterfaceRequest.setName("amazing-interface");
        createInterfaceRequest.setDescription("An amazing interface");
        createInterfaceRequest.setInterfaceJson("{}");

        given()
                .header("Content-Type", "application/json")
                .body(createInterfaceRequest)
                .when()
                .post("/calm/namespaces/finos/interfaces/5/versions/invalid-version")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForCreateInterfaceTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new InterfaceNotFoundException(), 404),
                Arguments.of("valid", new InterfaceVersionExistsException(), 409),
                Arguments.of("valid", new JsonParseException(), 400),
                Arguments.of("valid", null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreateInterfaceTests")
    void respond_correctly_to_create_interfaces(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws InterfaceNotFoundException, InterfaceVersionNotFoundException, NamespaceNotFoundException, InterfaceVersionExistsException {
        CreateInterfaceRequest createInterfaceRequest = new CreateInterfaceRequest();
        createInterfaceRequest.setName("amazing-interface");
        createInterfaceRequest.setDescription("An amazing interface");
        createInterfaceRequest.setInterfaceJson("{}");

        if (exceptionToThrow != null) {
            when(mockInterfaceStore.createInterfaceForVersion(createInterfaceRequest, namespace, 5, "1.0.1")).thenThrow(exceptionToThrow);
        } else {
            CalmInterface createdInterface = new CalmInterface(createInterfaceRequest);
            createdInterface.setId(5);
            createdInterface.setNamespace(namespace);
            createdInterface.setVersion("1.0.1");
            when(mockInterfaceStore.createInterfaceForVersion(createInterfaceRequest, namespace, 5, "1.0.1")).thenReturn(createdInterface);
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body(createInterfaceRequest)
                    .when()
                    .post("/calm/namespaces/" + namespace + "/interfaces/5/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    .header("Location", containsString("/calm/namespaces/valid/interfaces/5/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body(createInterfaceRequest)
                    .when()
                    .post("/calm/namespaces/" + namespace + "/interfaces/5/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockInterfaceStore, times(1)).createInterfaceForVersion(createInterfaceRequest, namespace, 5, "1.0.1");
    }
}
