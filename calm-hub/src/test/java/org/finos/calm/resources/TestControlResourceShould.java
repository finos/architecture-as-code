package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionNotFoundException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestControlResourceShould {

    private static final String INVALID_DOMAIN = "invalid-domain";
    private static final String VALID_DOMAIN = "valid-domain";

    @InjectMock
    ControlStore controlStore;

    @Test
    void return_404_when_domain_does_not_exist_on_get() {
        when(controlStore.getControlsForDomain(INVALID_DOMAIN)).thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .when()
                .get("/calm/domains/" + INVALID_DOMAIN + "/controls")
                .then()
                .statusCode(404);

        verify(controlStore).getControlsForDomain(INVALID_DOMAIN);
    }

    @Test
    void return_a_list_of_control_details_for_a_domain() {
        ControlDetail controlDetail = new ControlDetail(1, "Control Name", "Control Description");
        when(controlStore.getControlsForDomain(VALID_DOMAIN)).thenReturn(List.of(controlDetail));

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values[0].id", equalTo(controlDetail.getId()))
                .body("values[0].name", equalTo(controlDetail.getName()))
                .body("values[0].description", equalTo(controlDetail.getDescription()));

        verify(controlStore).getControlsForDomain(VALID_DOMAIN);
    }

    @Test
    void return_an_empty_list_when_no_controls_exist_for_domain() {
        when(controlStore.getControlsForDomain(VALID_DOMAIN)).thenReturn(List.of());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values", is(empty()));

        verify(controlStore).getControlsForDomain(VALID_DOMAIN);
    }

    @Test
    void return_201_when_control_created_for_valid_domain() {
        ControlDetail createdControl = new ControlDetail(5, "New Control", "New Description");
        when(controlStore.createControlRequirement(any(CreateControlRequirement.class), eq(VALID_DOMAIN))).thenReturn(createdControl);

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

        verify(controlStore).createControlRequirement(any(CreateControlRequirement.class), eq(VALID_DOMAIN));
    }

    @Test
    void return_404_when_creating_control_for_invalid_domain() {
        when(controlStore.createControlRequirement(any(CreateControlRequirement.class), eq(INVALID_DOMAIN)))
                .thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .header("Content-Type", "application/json")
                .body(new CreateControlRequirement("Test", "Test Desc", "{}"))
                .when()
                .post("/calm/domains/" + INVALID_DOMAIN + "/controls")
                .then()
                .statusCode(404);

        verify(controlStore).createControlRequirement(any(CreateControlRequirement.class), eq(INVALID_DOMAIN));
    }

    // --- Requirement Version Endpoints ---

    @Test
    void return_requirement_versions_for_valid_control() throws Exception {
        when(controlStore.getRequirementVersions(VALID_DOMAIN, 1)).thenReturn(List.of("1.0.0"));

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));

        verify(controlStore).getRequirementVersions(VALID_DOMAIN, 1);
    }

    @Test
    void return_404_for_requirement_versions_when_domain_not_found() throws Exception {
        when(controlStore.getRequirementVersions(INVALID_DOMAIN, 1)).thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .when()
                .get("/calm/domains/" + INVALID_DOMAIN + "/controls/1/requirement/versions")
                .then()
                .statusCode(404);

        verify(controlStore).getRequirementVersions(INVALID_DOMAIN, 1);
    }

    @Test
    void return_404_for_requirement_versions_when_control_not_found() throws Exception {
        when(controlStore.getRequirementVersions(VALID_DOMAIN, 999)).thenThrow(new ControlNotFoundException());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/999/requirement/versions")
                .then()
                .statusCode(404);

        verify(controlStore).getRequirementVersions(VALID_DOMAIN, 999);
    }

    @Test
    void return_requirement_json_for_valid_version() throws Exception {
        String requirementJson = "{\"type\": \"requirement\"}";
        when(controlStore.getRequirementForVersion(VALID_DOMAIN, 1, "1.0.0")).thenReturn(requirementJson);

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/1.0.0")
                .then()
                .statusCode(200)
                .body("type", equalTo("requirement"));

        verify(controlStore).getRequirementForVersion(VALID_DOMAIN, 1, "1.0.0");
    }

    @Test
    void return_404_for_requirement_version_when_domain_not_found() throws Exception {
        when(controlStore.getRequirementForVersion(INVALID_DOMAIN, 1, "1.0.0")).thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .when()
                .get("/calm/domains/" + INVALID_DOMAIN + "/controls/1/requirement/versions/1.0.0")
                .then()
                .statusCode(404);

        verify(controlStore).getRequirementForVersion(INVALID_DOMAIN, 1, "1.0.0");
    }

    @Test
    void return_404_for_requirement_version_when_version_not_found() throws Exception {
        when(controlStore.getRequirementForVersion(VALID_DOMAIN, 1, "9.9.9")).thenThrow(new ControlRequirementVersionNotFoundException());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/9.9.9")
                .then()
                .statusCode(404);

        verify(controlStore).getRequirementForVersion(VALID_DOMAIN, 1, "9.9.9");
    }

    @Test
    void return_404_for_requirement_version_when_control_not_found() throws Exception {
        when(controlStore.getRequirementForVersion(VALID_DOMAIN, 999, "1.0.0")).thenThrow(new ControlNotFoundException());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/999/requirement/versions/1.0.0")
                .then()
                .statusCode(404);

        verify(controlStore).getRequirementForVersion(VALID_DOMAIN, 999, "1.0.0");
    }

    // --- Configuration Endpoints ---

    @Test
    void return_configurations_for_valid_control() throws Exception {
        when(controlStore.getConfigurationsForControl(VALID_DOMAIN, 1)).thenReturn(List.of(10, 20));

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values[0]", equalTo(10))
                .body("values[1]", equalTo(20));

        verify(controlStore).getConfigurationsForControl(VALID_DOMAIN, 1);
    }

    @Test
    void return_empty_configurations_for_control_with_none() throws Exception {
        when(controlStore.getConfigurationsForControl(VALID_DOMAIN, 1)).thenReturn(List.of());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(200)
                .body("values", is(empty()));

        verify(controlStore).getConfigurationsForControl(VALID_DOMAIN, 1);
    }

    @Test
    void return_404_for_configurations_when_domain_not_found() throws Exception {
        when(controlStore.getConfigurationsForControl(INVALID_DOMAIN, 1)).thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .when()
                .get("/calm/domains/" + INVALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(404);

        verify(controlStore).getConfigurationsForControl(INVALID_DOMAIN, 1);
    }

    @Test
    void return_404_for_configurations_when_control_not_found() throws Exception {
        when(controlStore.getConfigurationsForControl(VALID_DOMAIN, 999)).thenThrow(new ControlNotFoundException());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/999/configurations")
                .then()
                .statusCode(404);

        verify(controlStore).getConfigurationsForControl(VALID_DOMAIN, 999);
    }

    // --- Configuration Version Endpoints ---

    @Test
    void return_configuration_versions_for_valid_config() throws Exception {
        when(controlStore.getConfigurationVersions(VALID_DOMAIN, 1, 10)).thenReturn(List.of("1.0.0", "2.0.0"));

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/10/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values[0]", equalTo("1.0.0"))
                .body("values[1]", equalTo("2.0.0"));

        verify(controlStore).getConfigurationVersions(VALID_DOMAIN, 1, 10);
    }

    @Test
    void return_404_for_configuration_versions_when_domain_not_found() throws Exception {
        when(controlStore.getConfigurationVersions(INVALID_DOMAIN, 1, 10)).thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .when()
                .get("/calm/domains/" + INVALID_DOMAIN + "/controls/1/configurations/10/versions")
                .then()
                .statusCode(404);

        verify(controlStore).getConfigurationVersions(INVALID_DOMAIN, 1, 10);
    }

    @Test
    void return_404_for_configuration_versions_when_control_not_found() throws Exception {
        when(controlStore.getConfigurationVersions(VALID_DOMAIN, 999, 10)).thenThrow(new ControlNotFoundException());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/999/configurations/10/versions")
                .then()
                .statusCode(404);

        verify(controlStore).getConfigurationVersions(VALID_DOMAIN, 999, 10);
    }

    @Test
    void return_404_for_configuration_versions_when_config_not_found() throws Exception {
        when(controlStore.getConfigurationVersions(VALID_DOMAIN, 1, 999)).thenThrow(new ControlConfigurationNotFoundException());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/999/versions")
                .then()
                .statusCode(404);

        verify(controlStore).getConfigurationVersions(VALID_DOMAIN, 1, 999);
    }

    @Test
    void return_configuration_json_for_specific_version() throws Exception {
        String configJson = "{\"version\": \"specific\"}";
        when(controlStore.getConfigurationForVersion(VALID_DOMAIN, 1, 10, "1.0.0")).thenReturn(configJson);

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/10/versions/1.0.0")
                .then()
                .statusCode(200)
                .body("version", equalTo("specific"));

        verify(controlStore).getConfigurationForVersion(VALID_DOMAIN, 1, 10, "1.0.0");
    }

    @Test
    void return_404_for_configuration_version_when_domain_not_found() throws Exception {
        when(controlStore.getConfigurationForVersion(INVALID_DOMAIN, 1, 10, "1.0.0")).thenThrow(new DomainNotFoundException(INVALID_DOMAIN));

        given()
                .when()
                .get("/calm/domains/" + INVALID_DOMAIN + "/controls/1/configurations/10/versions/1.0.0")
                .then()
                .statusCode(404);

        verify(controlStore).getConfigurationForVersion(INVALID_DOMAIN, 1, 10, "1.0.0");
    }

    @Test
    void return_404_for_configuration_version_when_control_not_found() throws Exception {
        when(controlStore.getConfigurationForVersion(VALID_DOMAIN, 999, 10, "1.0.0")).thenThrow(new ControlNotFoundException());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/999/configurations/10/versions/1.0.0")
                .then()
                .statusCode(404);

        verify(controlStore).getConfigurationForVersion(VALID_DOMAIN, 999, 10, "1.0.0");
    }

    @Test
    void return_404_for_configuration_version_when_version_not_found() throws Exception {
        when(controlStore.getConfigurationForVersion(VALID_DOMAIN, 1, 10, "9.9.9"))
                .thenThrow(new ControlConfigurationVersionNotFoundException());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/10/versions/9.9.9")
                .then()
                .statusCode(404);

        verify(controlStore).getConfigurationForVersion(VALID_DOMAIN, 1, 10, "9.9.9");
    }

    @Test
    void return_404_for_configuration_version_when_config_not_found() throws Exception {
        when(controlStore.getConfigurationForVersion(VALID_DOMAIN, 1, 999, "1.0.0"))
                .thenThrow(new ControlConfigurationNotFoundException());

        given()
                .when()
                .get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/999/versions/1.0.0")
                .then()
                .statusCode(404);

        verify(controlStore).getConfigurationForVersion(VALID_DOMAIN, 1, 999, "1.0.0");
    }
}
