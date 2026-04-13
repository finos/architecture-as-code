package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.junit.jupiter.api.*;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteStandardIntegration {

    CreateStandardRequest createStandardRequest;

    private static final String NAME = "Test Standard";
    private static final String DESCRIPTION = "Test Standard Description";

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
        createStandardRequest = new CreateStandardRequest(NAME, DESCRIPTION, "{}");
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_standards() {
        given()
                .when().get("/calm/namespaces/finos/standards")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_a_standard() {
        given()
                .body(createStandardRequest)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/standards")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/standards/1"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/standards/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_standard() {
        given()
                .when().get("/calm/namespaces/finos/standards/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo("{}"));
    }

    @Test
    @Order(5)
    void end_to_end_create_a_new_standard_version_for_standard() {
        setupTestStandardForPersistenceRetrieval();

        given()
                .body(createStandardRequest)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/standards/1/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/standards/1/versions/2.0.0"));
    }

    @Test
    @Order(6)
    void end_to_end_verify_retrieval_of_standard_json() {
        setupTestStandardForPersistenceRetrieval();

        given()
                .when().get("/calm/namespaces/finos/standards/1/versions/2.0.0")
                .then()
                .statusCode(200)
                .body(equalTo("{}"));
    }

    @Test
    @Order(7)
    void end_to_end_verify_standard_details_and_if_they_are_updated() {
        setupTestStandardForPersistenceRetrieval();

        Map<String, Object> expected = new HashMap<>();
        expected.put("id", 1);
        expected.put("name", "New Name");
        expected.put("description", "New Description");

        given()
                .when().get("/calm/namespaces/finos/standards")
                .then()
                .statusCode(200)
                .body("values", hasItem(equalTo(expected)));
    }

    private void setupTestStandardForPersistenceRetrieval() {
        createStandardRequest.setStandardJson("{}");
        createStandardRequest.setName("New Name");
        createStandardRequest.setDescription("New Description");
    }
}
