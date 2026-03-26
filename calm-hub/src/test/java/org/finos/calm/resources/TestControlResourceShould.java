package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionExistsException;
import org.finos.calm.domain.exception.ControlConfigurationVersionNotFoundException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionExistsException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_NAME_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestControlResourceShould {

    private static final String INVALID_DOMAIN = "invalid-domain";
    private static final String VALID_DOMAIN = "valid-domain";

    @InjectMock
    ControlStore mockControlStore;

    @Test
    void return_404_when_domain_does_not_exist_on_get() {
        when(mockControlStore.getControlsForDomain(INVALID_DOMAIN)).thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .when()
                .get("/calm/domains/" + INVALID_DOMAIN + "/controls")
                .then()
                .statusCode(404);

        verify(mockControlStore).getControlsForDomain(INVALID_DOMAIN);
    }

    @Test    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_get_controls() {
        given()
                .when()
                .get("/calm/domains/invalid_domain/controls")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }

    @Test    void return_a_list_of_control_details_for_a_domain() {
        ControlDetail controlDetail = new ControlDetail(1, "Control Name", "Control Description");
        when(mockControlStore.getControlsForDomain(VALID_DOMAIN)).thenReturn(List.of(controlDetail));

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values[0].id", equalTo(controlDetail.getId()))
                .body("values[0].name", equalTo(controlDetail.getName()))
                .body("values[0].description", equalTo(controlDetail.getDescription()));

        verify(mockControlStore).getControlsForDomain(VALID_DOMAIN);
    }

    @Test
    void return_an_empty_list_when_no_controls_exist_for_domain() {
        when(mockControlStore.getControlsForDomain(VALID_DOMAIN)).thenReturn(List.of());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values", is(empty()));

        verify(mockControlStore).getControlsForDomain(VALID_DOMAIN);
    }

    @Test
    void return_201_when_control_created_for_valid_domain() {
        ControlDetail createdControl = new ControlDetail(5, "New Control", "New Description");
        when(mockControlStore.createControlRequirement(any(CreateControlRequirement.class), eq(VALID_DOMAIN))).thenReturn(createdControl);

        given()
                .header("Content-Type", "application/json")
                .body(new CreateControlRequirement("New Control", "New Description", "{\"type\": \"control\"}"))
                .when()
                .post("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/5"))
                .body("id", equalTo(5))
                .body("name", equalTo("New Control"))
                .body("description", equalTo("New Description"));

        verify(mockControlStore).createControlRequirement(any(CreateControlRequirement.class), eq(VALID_DOMAIN));
    }

    @Test
    void return_404_when_creating_control_for_invalid_domain() {
        when(mockControlStore.createControlRequirement(any(CreateControlRequirement.class), eq(INVALID_DOMAIN)))
                .thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .header("Content-Type", "application/json")
                .body(new CreateControlRequirement("Test", "Test Desc", "{}"))
                .when()
                .post("/calm/domains/" + INVALID_DOMAIN + "/controls")
                .then()
                .statusCode(404);

        verify(mockControlStore).createControlRequirement(any(CreateControlRequirement.class), eq(INVALID_DOMAIN));
    }
    @Test
    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_create_control() {
        given()
                .header("Content-Type", "application/json")
                .body(new CreateControlRequirement("Test", "Test Desc", "{}"))
                .when()
                .post("/calm/domains/invalid_domain/controls")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }
    // --- Requirement Version Endpoints ---

    @Test
    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_get_requirement_versions() {
        given()
                .when()
                .get("/calm/domains/invalid_domain/controls/1/requirement/versions")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }

    static Stream<Arguments> provideParametersForRequirementVersionTests() {
        return Stream.of(
                Arguments.of(INVALID_DOMAIN, new DomainNotFoundException(INVALID_DOMAIN), 404),
                Arguments.of(VALID_DOMAIN, new ControlNotFoundException(), 404),
                Arguments.of(VALID_DOMAIN, null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForRequirementVersionTests")
    void respond_correctly_to_get_requirement_versions_query(String domain, Throwable exceptionToThrow, int expectedStatusCode) throws Exception {
        if (exceptionToThrow != null) {
            when(mockControlStore.getRequirementVersions(anyString(), anyInt())).thenThrow(exceptionToThrow);
        } else {
            when(mockControlStore.getRequirementVersions(anyString(), anyInt())).thenReturn(List.of("1.0.0"));
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/requirement/versions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body("values", hasSize(1))
                    .body("values[0]", equalTo("1.0.0"));
        } else {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/requirement/versions")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockControlStore).getRequirementVersions(domain, 1);
    }

    // --- Requirement for specific version ---

    @Test
    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_get_requirement_for_version() {
        given()
                .when()
                .get("/calm/domains/invalid_domain/controls/1/requirement/versions/1.0.0")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }

    @Test
    void return_a_400_when_an_invalid_format_of_version_is_provided_on_get_requirement_for_version() {
        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/1.0.invalid0")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForGetRequirementTests() {
        return Stream.of(
                Arguments.of(INVALID_DOMAIN, new DomainNotFoundException(INVALID_DOMAIN), 404),
                Arguments.of(VALID_DOMAIN, new ControlNotFoundException(), 404),
                Arguments.of(VALID_DOMAIN, new ControlRequirementVersionNotFoundException(), 404),
                Arguments.of(VALID_DOMAIN, null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetRequirementTests")
    void respond_correctly_to_get_requirement_for_version(String domain, Throwable exceptionToThrow, int expectedStatusCode) throws Exception {
        if (exceptionToThrow != null) {
            when(mockControlStore.getRequirementForVersion(anyString(), anyInt(), anyString())).thenThrow(exceptionToThrow);
        } else {
            when(mockControlStore.getRequirementForVersion(anyString(), anyInt(), anyString())).thenReturn("{\"type\": \"requirement\"}");
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/requirement/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body("type", equalTo("requirement"));
        } else {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/requirement/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockControlStore).getRequirementForVersion(domain, 1, "1.0.0");
    }

    // --- Configuration Endpoints ---

    @Test
    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_get_configurations() {
        given()
                .when()
                .get("/calm/domains/invalid_domain/controls/1/configurations")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }

    static Stream<Arguments> provideParametersForGetConfigurationsTests() {
        return Stream.of(
                Arguments.of(INVALID_DOMAIN, new DomainNotFoundException(INVALID_DOMAIN), 404),
                Arguments.of(VALID_DOMAIN, new ControlNotFoundException(), 404),
                Arguments.of(VALID_DOMAIN, null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetConfigurationsTests")
    void respond_correctly_to_get_configurations(String domain, Throwable exceptionToThrow, int expectedStatusCode) throws Exception {
        if (exceptionToThrow != null) {
            when(mockControlStore.getConfigurationsForControl(anyString(), anyInt())).thenThrow(exceptionToThrow);
        } else {
            when(mockControlStore.getConfigurationsForControl(anyString(), anyInt())).thenReturn(List.of(10, 20));
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/configurations")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body("values", hasSize(2))
                    .body("values[0]", equalTo(10))
                    .body("values[1]", equalTo(20));
        } else {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/configurations")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockControlStore).getConfigurationsForControl(domain, 1);
    }

    @Test
    void return_empty_configurations_for_control_with_none() throws Exception {
        when(mockControlStore.getConfigurationsForControl(VALID_DOMAIN, 1)).thenReturn(List.of());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(200)
                .body("values", is(empty()));

        verify(mockControlStore).getConfigurationsForControl(VALID_DOMAIN, 1);
    }

    // --- Configuration Version Endpoints ---

    @Test
    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_get_configuration_versions() {
        given()
                .when()
                .get("/calm/domains/invalid_domain/controls/1/configurations/10/versions")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }

    static Stream<Arguments> provideParametersForGetConfigurationVersionsTests() {
        return Stream.of(
                Arguments.of(INVALID_DOMAIN, new DomainNotFoundException(INVALID_DOMAIN), 404),
                Arguments.of(VALID_DOMAIN, new ControlNotFoundException(), 404),
                Arguments.of(VALID_DOMAIN, new ControlConfigurationNotFoundException(), 404),
                Arguments.of(VALID_DOMAIN, null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetConfigurationVersionsTests")
    void respond_correctly_to_get_configuration_versions(String domain, Throwable exceptionToThrow, int expectedStatusCode) throws Exception {
        if (exceptionToThrow != null) {
            when(mockControlStore.getConfigurationVersions(anyString(), anyInt(), anyInt())).thenThrow(exceptionToThrow);
        } else {
            when(mockControlStore.getConfigurationVersions(anyString(), anyInt(), anyInt())).thenReturn(List.of("1.0.0", "2.0.0"));
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/configurations/10/versions")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body("values", hasSize(2))
                    .body("values[0]", equalTo("1.0.0"))
                    .body("values[1]", equalTo("2.0.0"));
        } else {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/configurations/10/versions")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockControlStore).getConfigurationVersions(domain, 1, 10);
    }

    // --- Configuration for specific version ---

    @Test
    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_get_configuration_for_version() {
        given()
                .when()
                .get("/calm/domains/invalid_domain/controls/1/configurations/10/versions/1.0.0")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }

    @Test
    void return_a_400_when_an_invalid_format_of_version_is_provided_on_get_configuration_for_version() {
        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/10/versions/1.0.invalid0")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForGetConfigurationForVersionTests() {
        return Stream.of(
                Arguments.of(INVALID_DOMAIN, new DomainNotFoundException(INVALID_DOMAIN), 404),
                Arguments.of(VALID_DOMAIN, new ControlNotFoundException(), 404),
                Arguments.of(VALID_DOMAIN, new ControlConfigurationNotFoundException(), 404),
                Arguments.of(VALID_DOMAIN, new ControlConfigurationVersionNotFoundException(), 404),
                Arguments.of(VALID_DOMAIN, null, 200)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForGetConfigurationForVersionTests")
    void respond_correctly_to_get_configuration_for_version(String domain, Throwable exceptionToThrow, int expectedStatusCode) throws Exception {
        if (exceptionToThrow != null) {
            when(mockControlStore.getConfigurationForVersion(anyString(), anyInt(), anyInt(), anyString())).thenThrow(exceptionToThrow);
        } else {
            when(mockControlStore.getConfigurationForVersion(anyString(), anyInt(), anyInt(), anyString())).thenReturn("{\"version\": \"specific\"}");
        }

        if (expectedStatusCode == 200) {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/configurations/10/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .body("version", equalTo("specific"));
        } else {
            given()
                    .when()
                    .get("/calm/domains/" + domain + "/controls/1/configurations/10/versions/1.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }

        verify(mockControlStore).getConfigurationForVersion(domain, 1, 10, "1.0.0");
    }

    // --- createRequirementForVersion ---

    @Test
    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_create_requirement_version() {
        given()
                .header("Content-Type", "application/json")
                .body("{}")
                .when()
                .post("/calm/domains/invalid_domain/controls/1/requirement/versions/2.0.0")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }

    @Test
    void return_a_400_when_an_invalid_format_of_version_is_provided_on_create_requirement_version() {
        given()
                .header("Content-Type", "application/json")
                .body("{}")
                .when()
                .post("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/1.0invalid.1")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForCreateRequirementVersionTests() {
        return Stream.of(
                Arguments.of(new DomainNotFoundException(INVALID_DOMAIN), 404),
                Arguments.of(new ControlNotFoundException(), 404),
                Arguments.of(new ControlRequirementVersionExistsException(), 409),
                Arguments.of(new JsonParseException(), 400),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreateRequirementVersionTests")
    void respond_correctly_to_create_requirement_version(Throwable exceptionToThrow, int expectedStatusCode) throws Exception {
        if (exceptionToThrow != null) {
            doThrow(exceptionToThrow).when(mockControlStore)
                    .createRequirementForVersion(anyString(), anyInt(), anyString(), anyString());
        } else {
            doNothing().when(mockControlStore)
                    .createRequirementForVersion(anyString(), anyInt(), anyString(), anyString());
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body("{\"type\": \"req-v2\"}")
                    .when()
                    .post("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/2.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/2.0.0"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body("{\"type\": \"req-v2\"}")
                    .when()
                    .post("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/2.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }
    }

    // --- createControlConfiguration ---

    @Test
    void return_201_when_creating_configuration_for_valid_control() throws Exception {
        when(mockControlStore.createControlConfiguration(any(CreateControlConfiguration.class), eq(VALID_DOMAIN), eq(1)))
                .thenReturn(42);

        given()
                .header("Content-Type", "application/json")
                .body(new CreateControlConfiguration("{\"setting\": \"enabled\"}"))
                .when()
                .post("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/42"));
    }

    @Test
    void return_404_when_creating_configuration_for_invalid_domain() throws Exception {
        when(mockControlStore.createControlConfiguration(any(CreateControlConfiguration.class), eq(INVALID_DOMAIN), eq(1)))
                .thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .header("Content-Type", "application/json")
                .body(new CreateControlConfiguration("{}"))
                .when()
                .post("/calm/domains/" + INVALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(404);
    }

    @Test
    void return_404_when_creating_configuration_for_invalid_control() throws Exception {
        when(mockControlStore.createControlConfiguration(any(CreateControlConfiguration.class), eq(VALID_DOMAIN), eq(999)))
                .thenThrow(new ControlNotFoundException());

        given()
                .header("Content-Type", "application/json")
                .body(new CreateControlConfiguration("{}"))
                .when()
                .post("/calm/domains/" + VALID_DOMAIN + "/controls/999/configurations")
                .then()
                .statusCode(404);
    }

    @Test
    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_create_configuration() {
        given()
                .header("Content-Type", "application/json")
                .body(new CreateControlConfiguration("{}"))
                .when()
                .post("/calm/domains/invalid_domain/controls/1/configurations")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }

    // --- createConfigurationForVersion ---

    @Test
    void return_a_400_when_an_invalid_format_of_domain_is_provided_on_create_configuration_version() {
        given()
                .header("Content-Type", "application/json")
                .body("{}")
                .when()
                .post("/calm/domains/invalid_domain/controls/1/configurations/10/versions/2.0.0")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_NAME_MESSAGE));
    }

    @Test
    void return_a_400_when_an_invalid_format_of_version_is_provided_on_create_configuration_version() {
        given()
                .header("Content-Type", "application/json")
                .body("{}")
                .when()
                .post("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/10/versions/1.0invalid.1")
                .then()
                .statusCode(400)
                .body(containsString(VERSION_MESSAGE));
    }

    static Stream<Arguments> provideParametersForCreateConfigurationVersionTests() {
        return Stream.of(
                Arguments.of(new DomainNotFoundException(INVALID_DOMAIN), 404),
                Arguments.of(new ControlNotFoundException(), 404),
                Arguments.of(new ControlConfigurationNotFoundException(), 404),
                Arguments.of(new ControlConfigurationVersionExistsException(), 409),
                Arguments.of(new JsonParseException(), 400),
                Arguments.of(null, 201)
        );
    }

    @ParameterizedTest
    @MethodSource("provideParametersForCreateConfigurationVersionTests")
    void respond_correctly_to_create_configuration_version(Throwable exceptionToThrow, int expectedStatusCode) throws Exception {
        if (exceptionToThrow != null) {
            doThrow(exceptionToThrow).when(mockControlStore)
                    .createConfigurationForVersion(anyString(), anyInt(), anyInt(), anyString(), anyString());
        } else {
            doNothing().when(mockControlStore)
                    .createConfigurationForVersion(anyString(), anyInt(), anyInt(), anyString(), anyString());
        }

        if (expectedStatusCode == 201) {
            given()
                    .header("Content-Type", "application/json")
                    .body("{\"setting\": \"v2\"}")
                    .when()
                    .post("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/10/versions/2.0.0")
                    .then()
                    .statusCode(expectedStatusCode)
                    .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/10/versions/2.0.0"));
        } else {
            given()
                    .header("Content-Type", "application/json")
                    .body("{\"setting\": \"v2\"}")
                    .when()
                    .post("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/10/versions/2.0.0")
                    .then()
                    .statusCode(expectedStatusCode);
        }
    }
}
