package integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteControlIntegration {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String VALID_DOMAIN = "security";
    private static final String INVALID_DOMAIN = "nonexistent";

    @BeforeEach
    public void setup() {
        NitriteSetup.domainSetup();
    }

    // --- Controls CRUD ---

    @Test
    @Order(1)
    void end_to_end_get_controls_returns_empty_for_valid_domain() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_get_controls_returns_404_for_invalid_domain() {
        given()
                .when().get("/calm/domains/" + INVALID_DOMAIN + "/controls")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(3)
    void end_to_end_create_control_for_valid_domain() throws JsonProcessingException {
        CreateControlRequirement request = new CreateControlRequirement(
                "Access Control", "Ensure proper access control mechanisms", "{\"type\": \"requirement\"}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/"))
                .body("name", equalTo("Access Control"))
                .body("description", equalTo("Ensure proper access control mechanisms"));
    }

    @Test
    @Order(4)
    void end_to_end_get_controls_returns_created_control() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0].name", equalTo("Access Control"))
                .body("values[0].description", equalTo("Ensure proper access control mechanisms"));
    }

    @Test
    @Order(5)
    void end_to_end_create_control_returns_404_for_invalid_domain() throws JsonProcessingException {
        CreateControlRequirement request = new CreateControlRequirement(
                "Test Control", "Test Description", "{}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + INVALID_DOMAIN + "/controls")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(6)
    void end_to_end_create_second_control_for_same_domain() throws JsonProcessingException {
        CreateControlRequirement request = new CreateControlRequirement(
                "Encryption", "Ensure data is encrypted at rest and in transit", "{\"type\": \"requirement\"}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(201)
                .body("name", equalTo("Encryption"))
                .body("description", equalTo("Ensure data is encrypted at rest and in transit"));
    }

    @Test
    @Order(7)
    void end_to_end_get_controls_returns_both_controls() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls")
                .then()
                .statusCode(200)
                .body("values", hasSize(2));
    }

    // --- Requirement Version Endpoints ---

    @Test
    @Order(8)
    void end_to_end_get_requirement_versions_for_created_control() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(9)
    void end_to_end_get_requirement_at_version() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/1.0.0")
                .then()
                .statusCode(200)
                .body("type", equalTo("requirement"));
    }

    @Test
    @Order(10)
    void end_to_end_get_requirement_versions_returns_404_for_invalid_control() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/999/requirement/versions")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(11)
    void end_to_end_get_requirement_version_returns_404_for_invalid_version() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/9.9.9")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(12)
    void end_to_end_get_requirement_versions_returns_404_for_invalid_domain() {
        given()
                .when().get("/calm/domains/" + INVALID_DOMAIN + "/controls/1/requirement/versions")
                .then()
                .statusCode(404);
    }

    // --- Configuration Endpoints (empty state) ---

    @Test
    @Order(13)
    void end_to_end_get_configurations_returns_empty_for_control_with_no_configurations() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(14)
    void end_to_end_get_configurations_returns_404_for_invalid_control() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/999/configurations")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(15)
    void end_to_end_get_configuration_returns_404_for_nonexistent_config() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/999")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(16)
    void end_to_end_get_configuration_versions_returns_404_for_nonexistent_config() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/999/versions")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(17)
    void end_to_end_get_configuration_version_returns_404_for_nonexistent_config() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/999/versions/1.0.0")
                .then()
                .statusCode(404);
    }

    // --- Create Configuration via API ---

    @Test
    @Order(18)
    void end_to_end_create_configuration_for_existing_control() throws JsonProcessingException {
        CreateControlConfiguration request = new CreateControlConfiguration("{\"setting\": \"enabled\"}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/"));
    }

    @Test
    @Order(19)
    void end_to_end_get_configurations_returns_created_configuration() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(200)
                .body("values", hasSize(1));
    }

    @Test
    @Order(20)
    void end_to_end_get_configuration_versions() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(21)
    void end_to_end_get_configuration_at_specific_version() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body("setting", equalTo("enabled"));
    }

    @Test
    @Order(22)
    void end_to_end_get_configuration_at_invalid_version_returns_404() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/1/versions/9.9.9")
                .then()
                .statusCode(404);
    }

    // --- Create Requirement Versions ---

    @Test
    @Order(23)
    void end_to_end_create_requirement_version_for_existing_control() {
        given()
                .body("{\"type\": \"requirement-v2\"}")
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/2.0.0"));
    }

    @Test
    @Order(24)
    void end_to_end_get_requirement_versions_returns_both_versions() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values", hasItems("1.0.0", "2.0.0"));
    }

    @Test
    @Order(25)
    void end_to_end_get_requirement_at_new_version() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/2.0.0")
                .then()
                .statusCode(200)
                .body("type", equalTo("requirement-v2"));
    }

    @Test
    @Order(26)
    void end_to_end_create_requirement_version_returns_409_for_existing_version() {
        given()
                .body("{\"type\": \"duplicate\"}")
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls/1/requirement/versions/1.0.0")
                .then()
                .statusCode(409);
    }

    @Test
    @Order(27)
    void end_to_end_create_requirement_version_returns_404_for_invalid_domain() {
        given()
                .body("{}")
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + INVALID_DOMAIN + "/controls/1/requirement/versions/2.0.0")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(28)
    void end_to_end_create_requirement_version_returns_404_for_invalid_control() {
        given()
                .body("{}")
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls/999/requirement/versions/2.0.0")
                .then()
                .statusCode(404);
    }

    // --- Create More Configurations ---

    @Test
    @Order(29)
    void end_to_end_create_second_configuration() throws JsonProcessingException {
        CreateControlConfiguration request = new CreateControlConfiguration("{\"setting\": \"active\"}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/"));
    }

    @Test
    @Order(30)
    void end_to_end_get_configurations_returns_both() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(200)
                .body("values", hasSize(2));
    }

    @Test
    @Order(31)
    void end_to_end_create_configuration_returns_404_for_invalid_domain() throws JsonProcessingException {
        CreateControlConfiguration request = new CreateControlConfiguration("{}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + INVALID_DOMAIN + "/controls/1/configurations")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(32)
    void end_to_end_create_configuration_returns_404_for_invalid_control() throws JsonProcessingException {
        CreateControlConfiguration request = new CreateControlConfiguration("{}");

        given()
                .body(objectMapper.writeValueAsString(request))
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls/999/configurations")
                .then()
                .statusCode(404);
    }

    // --- Create Configuration Versions ---

    @Test
    @Order(33)
    void end_to_end_create_configuration_version() {
        given()
                .body("{\"setting\": \"enabled-v2\"}")
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/1/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/1/versions/2.0.0"));
    }

    @Test
    @Order(34)
    void end_to_end_get_configuration_versions_returns_both() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values", hasItems("1.0.0", "2.0.0"));
    }

    @Test
    @Order(35)
    void end_to_end_get_configuration_at_new_version() {
        given()
                .when().get("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/1/versions/2.0.0")
                .then()
                .statusCode(200)
                .body("setting", equalTo("enabled-v2"));
    }

    @Test
    @Order(36)
    void end_to_end_create_configuration_version_returns_409_for_existing_version() {
        given()
                .body("{\"setting\": \"dup\"}")
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/1/versions/1.0.0")
                .then()
                .statusCode(409);
    }

    @Test
    @Order(37)
    void end_to_end_create_configuration_version_returns_404_for_invalid_config() {
        given()
                .body("{}")
                .header("Content-Type", "application/json")
                .when().post("/calm/domains/" + VALID_DOMAIN + "/controls/1/configurations/999/versions/2.0.0")
                .then()
                .statusCode(404);
    }
}
