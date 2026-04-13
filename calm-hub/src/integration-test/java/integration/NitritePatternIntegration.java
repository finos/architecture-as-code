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
}
