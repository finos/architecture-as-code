package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteArchitectureIntegration {

    public static final String ARCHITECTURE = "{\"name\": \"demo-pattern\"}";

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_architecture() {
        given()
                .when().get("/calm/namespaces/finos/architectures")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_an_architecture() {
        String payload = """
                {
                     "name": "name",
                     "description": "description",
                     "architectureJson": "{\\"name\\": \\"demo-pattern\\"}"
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/architectures")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/architectures/1"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/architectures/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_architecture() {
        given()
                .when().get("/calm/namespaces/finos/architectures/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(ARCHITECTURE));
    }
}
