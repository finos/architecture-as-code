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

    @Test
    @Order(1)
    void end_to_end_get_with_no_patterns() {
        given()
                .when().get("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_a_pattern() {
        String payload = """
                {
                     "name": "name",
                     "description": "description",
                     "patternJson": "{\\"name\\": \\"demo-pattern\\"}"
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/patterns")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/patterns/1"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/patterns/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_pattern() {
        given()
                .when().get("/calm/namespaces/finos/patterns/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(PATTERN));
    }
}
