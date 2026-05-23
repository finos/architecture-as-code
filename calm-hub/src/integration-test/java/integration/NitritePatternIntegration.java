package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitritePatternIntegration {

    public static final String PATTERN = "{\"name\": \"demo-pattern\"}";

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
    }

    private static String createdPatternId;

    @Test
    @Order(1)
    void end_to_end_create_a_pattern() {
        String payload = """
                {
                     "name": "name",
                     "description": "description",
                     "patternJson": "{\\"name\\": \\"demo-pattern\\"}"
                }
                """;

        var response = given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/patterns/"))
                .extract();

        String location = response.header("Location");
        // Extract pattern ID from Location header (e.g. /calm/namespaces/finos/patterns/2/versions/1-0-0)
        String[] parts = location.split("/");
        for (int i = 0; i < parts.length; i++) {
            if ("patterns".equals(parts[i]) && i + 1 < parts.length) {
                createdPatternId = parts[i + 1];
                break;
            }
        }
    }

    @Test
    @Order(2)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/patterns/" + createdPatternId + "/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_pattern() {
        given()
                .when().get("/calm/namespaces/finos/patterns/" + createdPatternId + "/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(PATTERN));
    }

    // --- Wrapper name/description sync from JSON body on new version ---

    @Test
    @Order(4)
    void end_to_end_list_patterns_returns_wrapper_name_and_description_from_create() {
        int id = Integer.parseInt(createdPatternId);
        given()
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values.find { it.id == " + id + " }.name", equalTo("name"))
                .body("values.find { it.id == " + id + " }.description", equalTo("description"));
    }

    @Test
    @Order(5)
    void end_to_end_create_pattern_version_with_name_and_description_in_envelope() {
        String versionBody = "{\"name\": \"updated-pattern\", \"description\": \"updated pattern description\", \"patternJson\": \"{\\\"nodes\\\": []}\"}";

        given()
                .body(versionBody)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/" + createdPatternId + "/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/" + createdPatternId + "/versions/2.0.0"));
    }

    @Test
    @Order(6)
    void end_to_end_list_patterns_reflects_updated_name_and_description_after_new_version() {
        int id = Integer.parseInt(createdPatternId);
        given()
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values.find { it.id == " + id + " }.name", equalTo("updated-pattern"))
                .body("values.find { it.id == " + id + " }.description", equalTo("updated pattern description"));
    }

    @Test
    @Order(7)
    void end_to_end_create_pattern_version_stores_only_inner_patternJson_and_updates_wrapper() {
        int id = Integer.parseInt(createdPatternId);
        String inner = "{\"nodes\": [], \"relationships\": []}";
        String envelope = "{\"name\": \"third-name\", \"description\": \"third description\", \"patternJson\": \"" + inner.replace("\"", "\\\"") + "\"}";

        given()
                .body(envelope)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns/" + createdPatternId + "/versions/3.0.0")
                .then()
                .statusCode(201);

        // Stored content must be the inner patternJson verbatim, not the envelope
        given()
                .when().get("/calm/namespaces/finos/patterns/" + createdPatternId + "/versions/3.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(inner));

        // Wrapper reflects the latest envelope name/description
        given()
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values.find { it.id == " + id + " }.name", equalTo("third-name"))
                .body("values.find { it.id == " + id + " }.description", equalTo("third description"));
    }
}
