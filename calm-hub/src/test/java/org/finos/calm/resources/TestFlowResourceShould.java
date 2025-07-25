package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionExistsException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.FlowStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestFlowResourceShould {

    @InjectMock
    FlowStore mockFlowStore;

    @Test
    void return_a_404_when_an_invalid_namespace_is_provided_on_get_flows() throws NamespaceNotFoundException {
        when(mockFlowStore.getFlowsForNamespace(anyString())).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/invalid/flows")
                .then()
                .statusCode(404);

        verify(mockFlowStore, times(1)).getFlowsForNamespace("invalid");
    }

    @Test
    void return_list_of_flow_ids_when_valid_namespace_provided_on_get_flows() throws NamespaceNotFoundException {
        when(mockFlowStore.getFlowsForNamespace(anyString())).thenReturn(Arrays.asList(12345, 54321));

        given()
                .when()
                .get("/calm/namespaces/valid/flows")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[12345,54321]}"));

        verify(mockFlowStore, times(1)).getFlowsForNamespace("valid");
    }

    @Test
    void return_latest_flow_version_when_valid_namespace_and_flow_id_provided() throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionNotFoundException {
        String flowJson = "{ \"test\": \"json\" }";
        Flow.FlowBuilder mockFlowBuilder = new Flow.FlowBuilder().setNamespace("validNamespace").setId(1);
        Flow flowWithoutVersion = mockFlowBuilder.build();
        when(mockFlowStore.getFlowVersions(any(Flow.class))).thenReturn(Arrays.asList("v1", "v2", "v3"));
        Flow expectedFlow = mockFlowBuilder.setVersion("v3").build();
        when(mockFlowStore.getFlowForVersion(expectedFlow)).thenReturn(flowJson);

        given()
                .when()
                .get("/calm/namespaces/validNamespace/flows/1")
                .then()
                .statusCode(200);

        verify(mockFlowStore, times(1)).getFlowVersions(flowWithoutVersion);
        verify(mockFlowStore, times(1)).getFlowForVersion(expectedFlow);
    }

    @Test
    void return_404_with_invalid_namespace_response_when_namespace_not_found() throws NamespaceNotFoundException, FlowNotFoundException {
        String invalidNamespace = "invalidNamespace";
        int validFlowId = 1;
        Flow flow = new Flow.FlowBuilder()
                .setNamespace(invalidNamespace)
                .setId(validFlowId)
                .build();

        when(mockFlowStore.getFlowVersions(flow)).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/" + invalidNamespace + "/flows/" + validFlowId)
                .then()
                .statusCode(404);


    }

    @Test
    void return_404_with_invalid_flow_response_when_flow_not_found() throws NamespaceNotFoundException, FlowNotFoundException, FlowVersionNotFoundException {
        String validNamespace = "validNamespace";
        int invalidFlowId = 999; // invalid flow ID
        Flow flow = new Flow.FlowBuilder()
                .setNamespace(validNamespace)
                .setId(invalidFlowId)
                .build();

        when(mockFlowStore.getFlowVersions(flow)).thenReturn(Arrays.asList("v1", "v2", "v3"));
        when(mockFlowStore.getFlowForVersion(any(Flow.class))).thenThrow(new FlowNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/" + validNamespace + "/flows/" + invalidFlowId)
                .then()
                .statusCode(404);

    }



    @Test
    void return_a_404_when_invalid_namespace_is_provided_on_create_flow() throws NamespaceNotFoundException {
        when(mockFlowStore.createFlowForNamespace(any(Flow.class)))
                .thenThrow(new NamespaceNotFoundException());

        String flowJson = "{ \"test\": \"json\" }";

        given()
                .header("Content-Type", "application/json")
                .body(flowJson)
                .when()
                .post("/calm/namespaces/invalid/flows")
                .then()
                .statusCode(404);

        Flow expectedFlow = new Flow.FlowBuilder()
                .setFlow(flowJson)
                .setNamespace("invalid")
                .build();

        verify(mockFlowStore, times(1)).createFlowForNamespace(expectedFlow);
    }

    @Test
    void return_a_400_when_invalid_flow_json_is_provided_on_create_flow() throws NamespaceNotFoundException {
        when(mockFlowStore.createFlowForNamespace(any(Flow.class)))
                .thenThrow(new JsonParseException());

        String flow = "{ \"test\": im invalid json";

        given()
                .header("Content-Type", "application/json")
                .body(flow)
                .when()
                .post("/calm/namespaces/invalid/flows")
                .then()
                .statusCode(400);

        Flow expectedFlow = new Flow.FlowBuilder()
                .setFlow(flow)
                .setNamespace("invalid")
                .build();

        verify(mockFlowStore, times(1)).createFlowForNamespace(expectedFlow);
    }

    @Test
    void return_a_created_with_location_of_flow_when_creating_flow() throws NamespaceNotFoundException {
        String flowJson = "{ \"test\": \"json\" }";
        String namespace = "valid";

        Flow stubbedReturnFlow = new Flow.FlowBuilder()
                .setFlow(flowJson)
                .setVersion("1.0.0")
                .setId(12)
                .setNamespace(namespace)
                .build();

        when(mockFlowStore.createFlowForNamespace(any(Flow.class))).thenReturn(stubbedReturnFlow);

        given()
                .header("Content-Type", "application/json")
                .body(flowJson)
                .when()
                .post("/calm/namespaces/valid/flows")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/valid/flows/12/versions/1.0.0"));

        Flow expectedFlowToCreate = new Flow.FlowBuilder()
                .setFlow(flowJson)
                .setNamespace(namespace)
                .build();

        verify(mockFlowStore, times(1)).createFlowForNamespace(expectedFlowToCreate);
    }

    static Stream<Arguments> provideParametersForFlowVersionTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new FlowNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForFlowVersionTests")
    void respond_correctly_to_get_flow_versions_query(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws FlowNotFoundException, NamespaceNotFoundException {
        var versions = List.of("1.0.0", "1.0.1");
        if (exceptionToThrow != null) {
            when(mockFlowStore.getFlowVersions(any(Flow.class))).thenThrow(exceptionToThrow);
        } else {
            when(mockFlowStore.getFlowVersions(any(Flow.class))).thenReturn(versions);
        }

        if (expectedStatusCode == 200) {
            String expectedBody = "{\"values\":[\"1.0.0\",\"1.0.1\"]}";
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/flows/12/versions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo(expectedBody));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/flows/12/versions")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        Flow expectedFlowToRetrieve = new Flow.FlowBuilder()
                .setNamespace(namespace)
                .setId(12)
                .build();

        verify(mockFlowStore, times(1)).getFlowVersions(expectedFlowToRetrieve);
    }

    @Test
    void return_400_error_when_version_is_not_valid_when_getting_flow_version() {
        given()
                .when()
                .get("/calm/namespaces/finos/flows/12/versions/invalid-version")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForGetFlowTests() {
        return Stream.of(
                Arguments.of("invalid", new NamespaceNotFoundException(), 404),
                Arguments.of("valid", new FlowNotFoundException(), 404),
                Arguments.of("valid", new FlowVersionNotFoundException(), 404),
                Arguments.of("valid", null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetFlowTests")
    void respond_correctly_to_get_flow_for_a_specific_version_correctly(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws FlowVersionNotFoundException, FlowNotFoundException, NamespaceNotFoundException {
        if (exceptionToThrow != null) {
            when(mockFlowStore.getFlowForVersion(any(Flow.class))).thenThrow(exceptionToThrow);
        } else {
            String flow = "{ \"test\": \"json\" }";
            when(mockFlowStore.getFlowForVersion(any(Flow.class))).thenReturn(flow);
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/flows/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body(equalTo("{ \"test\": \"json\" }"));
        } else {
            given()
                    .when()
                    .get("/calm/namespaces/" + namespace + "/flows/12/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        Flow expectedFlowToRetrieve = new Flow.FlowBuilder()
                .setNamespace(namespace)
                .setId(12)
                .setVersion("1.0.0")
                .build();

        verify(mockFlowStore, times(1)).getFlowForVersion(expectedFlowToRetrieve);
    }

    @Test
    void return_400_error_when_version_is_not_valid_when_creating_new_flow_version() {
        String flowJson = "{ \"test\": \"json\" }";

        given()
                .header("Content-Type", "application/json")
                .body(flowJson)
                .when()
                .post("/calm/namespaces/test/flows/20/versions/invalid-version")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForCreateFlowTests() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404),
                Arguments.of(new FlowNotFoundException(), 404),
                Arguments.of(new FlowVersionExistsException(), 409),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreateFlowTests")
    void respond_correctly_to_create_flow(Throwable exceptionToThrow, int expectedStatusCode) throws FlowNotFoundException, FlowVersionExistsException, NamespaceNotFoundException {
        Flow expectedFlow = new Flow.FlowBuilder()
                .setNamespace("test")
                .setVersion("1.0.1")
                .setFlow("{ \"test\": \"json\" }")
                .setId(20)
                .build();

        if (exceptionToThrow != null) {
            when(mockFlowStore.createFlowForVersion(expectedFlow)).thenThrow(exceptionToThrow);
        } else {
            when(mockFlowStore.createFlowForVersion(expectedFlow)).thenReturn(expectedFlow);
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body(expectedFlow.getFlowJson())
                    .when()
                    .post("/calm/namespaces/test/flows/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode)
                    .header("Location", containsString("/calm/namespaces/test/flows/20/versions/1.0.1"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body(expectedFlow.getFlowJson())
                    .when()
                    .post("/calm/namespaces/test/flows/20/versions/1.0.1")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockFlowStore, times(1)).createFlowForVersion(expectedFlow);
    }

    @Test
    void return_forbidden_for_put_operations_on_flows_default_and_when_configured() {
        given()
                .header("Content-Type", "application/json")
                .body("{ \"test\": \"json\" }")
                .when()
                .put("/calm/namespaces/test/flows/20/versions/1.0.1")
                .then()
                .statusCode(403);
    }
}
