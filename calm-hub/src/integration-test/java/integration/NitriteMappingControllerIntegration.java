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
        NitriteSetup.domainSetup();
    }

    @Test
    @Order(1)
    void create_pattern_via_name_based_api() {
        String payload = "{\"name\": \"front-controller-test\", \"$id\": \"http://localhost:8080/calm/namespaces/finos/patterns/test-pattern/versions/1.0.0\"}";

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/test-pattern/versions/1.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/test-pattern/versions/1.0.0"));
    }

    @Test
    @Order(2)
    void get_latest_version_by_name() {
        given()
                .when().get("/calm/namespaces/finos/patterns/test-pattern")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test"));
    }

    @Test
    @Order(3)
    void get_specific_version_by_name() {
        given()
                .when().get("/calm/namespaces/finos/patterns/test-pattern/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test"));
    }

    @Test
    @Order(4)
    void list_versions_by_name() {
        given()
                .when().get("/calm/namespaces/finos/patterns/test-pattern/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(5)
    void add_second_version_to_existing_resource() {
        String payload = "{\"name\": \"front-controller-test-v2\", \"$id\": \"http://localhost:8080/calm/namespaces/finos/patterns/test-pattern/versions/1.1.0\"}";

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/test-pattern/versions/1.1.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/test-pattern/versions/1.1.0"));
    }

    @Test
    @Order(6)
    void get_latest_returns_newest_version() {
        given()
                .when().get("/calm/namespaces/finos/patterns/test-pattern")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test-v2"));
    }

    @Test
    @Order(7)
    void original_version_still_accessible() {
        given()
                .when().get("/calm/namespaces/finos/patterns/test-pattern/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("front-controller-test"));
    }

    @Test
    @Order(8)
    void list_versions_shows_both() {
        given()
                .when().get("/calm/namespaces/finos/patterns/test-pattern/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values", hasItems("1.0.0", "1.1.0"));
    }

    @Test
    @Order(9)
    void list_named_patterns_includes_created_resource() {
        given()
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values", hasSize(greaterThanOrEqualTo(1)))
                .body("values.customId", hasItem("test-pattern"));
    }

    @Test
    @Order(10)
    void return_404_for_nonexistent_name() {
        given()
                .when().get("/calm/namespaces/finos/patterns/nonexistent-resource")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(11)
    void return_400_for_invalid_type() {
        given()
                .body("{}")
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/bananas/test-resource")
                .then()
                .statusCode(400)
                .body(containsString("Unsupported resource type"));
    }

    @Test
    @Order(12)
    void add_specific_version_via_versioned_endpoint() {
        String payload = "{\"name\": \"front-controller-test-v4\", \"$id\": \"http://localhost:8080/calm/namespaces/finos/patterns/test-pattern/versions/2.0.0\"}";

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/test-pattern/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/test-pattern/versions/2.0.0"));
    }

    @Test
    @Order(13)
    void return_409_when_specific_version_already_exists() {
        String payload = "{\"name\": \"front-controller-test-dup\", \"$id\": \"http://localhost:8080/calm/namespaces/finos/patterns/test-pattern/versions/2.0.0\"}";

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/test-pattern/versions/2.0.0")
                .then()
                .statusCode(409);
    }

    @Test
    @Order(14)
    void return_400_when_versioned_id_does_not_match_path() {
        String payload = "{\"name\": \"mismatch\", \"$id\": \"http://localhost:8080/calm/namespaces/finos/patterns/test-pattern/versions/4.0.0\"}";

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/test-pattern/versions/3.0.0")
                .then()
                .statusCode(400)
                .body(containsString("does not match"));
    }

    @Test
    @Order(15)
    void return_400_when_first_version_is_not_1_0_0() {
        String payload = "{\"name\": \"seeded\", \"$id\": \"http://localhost:8080/calm/namespaces/finos/patterns/seeded-pattern/versions/2.0.0\"}";

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/seeded-pattern/versions/2.0.0")
                .then()
                .statusCode(400)
                .body(containsString("first version of a resource must be 1.0.0"));
    }

    // =========================================================================
    // User Facing API — Domains
    // =========================================================================

    @Test
    @Order(16)
    void user_facing_get_domains_returns_existing_domain() {
        given()
                .when().get("/calm/domains")
                .then()
                .statusCode(200)
                .body("values", hasItem("security"));
    }

    @Test
    @Order(17)
    void user_facing_create_domain_returns_201() {
        given()
                .header("Content-Type", "application/json")
                .body("{\"name\":\"compliance\"}")
                .when().post("/calm/domains")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/compliance"));
    }

    @Test
    @Order(18)
    void user_facing_create_domain_returns_409_on_duplicate() {
        given()
                .header("Content-Type", "application/json")
                .body("{\"name\":\"compliance\"}")
                .when().post("/calm/domains")
                .then()
                .statusCode(409);
    }

    // =========================================================================
    // User Facing API — Controls (name-based)
    // =========================================================================

    @Test
    @Order(19)
    void user_facing_get_controls_returns_empty_for_new_domain() {
        given()
                .when().get("/calm/domains/compliance/controls")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(20)
    void user_facing_create_control_returns_201_with_name_based_location() {
        String payload = "{\"description\":\"Ensure proper access control\",\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/requirement/versions/1.0.0\"}";
        given()
                .header("Content-Type", "application/json")
                .body(payload)
                .when().post("/calm/domains/security/controls/access-control/requirement/versions/1.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/security/controls/access-control/requirement/versions/1.0.0"));
    @Order(21)
    void user_facing_get_controls_returns_created_control() {
        given()
                .when().get("/calm/domains/security/controls")
                .then()
                .statusCode(200)
                .body("values.name", hasItem("access-control"));
    }

    @Test
    @Order(22)
    void user_facing_get_requirement_versions_by_control_name() {
        given()
                .when().get("/calm/domains/security/controls/access-control/requirement/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(greaterThanOrEqualTo(1)));
    }

    @Test
    @Order(23)
    void user_facing_get_requirement_for_version_by_control_name() {
        given()
                .when().get("/calm/domains/security/controls/access-control/requirement/versions/1.0.0")
                .then()
                .statusCode(200)
                .body("type", equalTo("requirement"));
    }

    @Test
    @Order(24)
    void user_facing_get_configurations_by_control_name_returns_empty() {
        given()
                .when().get("/calm/domains/security/controls/access-control/configurations")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(25)
    void user_facing_returns_404_for_unknown_control_name() {
        given()
                .when().get("/calm/domains/security/controls/nonexistent-control/requirement/versions")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(26)
    void user_facing_returns_404_for_unknown_domain_on_controls() {
        given()
                .when().get("/calm/domains/unknown-domain/controls")
                .then()
                .statusCode(404);
    }
}
