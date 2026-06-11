package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteMappingControllerIntegration {

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
    }

    @Test
    @Order(1)
    void create_pattern_via_front_controller() {
        String payload = """
                {
                    "type": "PATTERN",
                    "json": "{\\"name\\": \\"front-controller-test\\"}"
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/mappings/test-pattern")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/mappings/test-pattern/versions/1.0.0"));
    }

    @Test
    @Order(2)
    void get_latest_version_by_custom_id() {
        given()
                .when().get("/calm/namespaces/finos/mappings/test-pattern")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test"));
    }

    @Test
    @Order(3)
    void get_specific_version_by_custom_id() {
        given()
                .when().get("/calm/namespaces/finos/mappings/test-pattern/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test"));
    }

    @Test
    @Order(4)
    void list_versions_by_custom_id() {
        given()
                .when().get("/calm/namespaces/finos/mappings/test-pattern/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(5)
    void update_resource_with_minor_version_bump() {
        String payload = """
                {
                    "json": "{\\"name\\": \\"front-controller-test-v2\\"}",
                    "changeType": "MINOR"
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/mappings/test-pattern")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/mappings/test-pattern/versions/1.1.0"));
    }

    @Test
    @Order(6)
    void get_latest_returns_newest_version() {
        given()
                .when().get("/calm/namespaces/finos/mappings/test-pattern")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test-v2"));
    }

    @Test
    @Order(7)
    void list_versions_shows_both() {
        given()
                .when().get("/calm/namespaces/finos/mappings/test-pattern/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values", hasItems("1.0.0", "1.1.0"));
    }

    @Test
    @Order(8)
    void lookup_mappings_includes_created_mapping() {
        given()
                .when().get("/calm/namespaces/finos/mappings?type=PATTERN")
                .then()
                .statusCode(200)
                .body("values", hasSize(greaterThanOrEqualTo(1)))
                .body("values.customId", hasItem("test-pattern"));
    }

    @Test
    @Order(9)
    void return_404_for_nonexistent_custom_id() {
        given()
                .when().get("/calm/namespaces/finos/mappings/nonexistent-resource")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(10)
    void link_existing_resource_to_new_custom_id() {
        Integer numericId = given()
                .when().get("/calm/namespaces/finos/mappings?type=PATTERN")
                .then()
                .statusCode(200)
                .extract().path("values.find { it.customId == 'test-pattern' }.numericId");

        String payload = """
                {
                    "type": "PATTERN",
                    "resourceId": %d
                }
                """.formatted(numericId);

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().put("/calm/namespaces/finos/mappings/test-pattern-alias")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/mappings/test-pattern-alias/versions/"));

        // The alias resolves to the same underlying resource
        given()
                .when().get("/calm/namespaces/finos/mappings/test-pattern-alias")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test"));
    }

    @Test
    @Order(11)
    void link_to_nonexistent_resource_returns_404() {
        String payload = """
                {
                    "type": "PATTERN",
                    "resourceId": 9999
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().put("/calm/namespaces/finos/mappings/ghost-alias")
                .then()
                .statusCode(404);
    }
}
