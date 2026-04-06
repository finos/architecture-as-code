package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteFlowIntegration {

    public static final String FLOW = "{\"name\": \"demo-flow\"}";
    public static final String FLOW_V2 = "{\"name\": \"demo-flow-v2\"}";

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_flow() {
        given()
                .when().get("/calm/namespaces/finos/flows")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_a_flow() {
        String payload = """
                {
                     "name": "name",
                     "description": "description",
                     "flowJson": "{\\"name\\": \\"demo-flow\\"}"
                }
                """;

        given()
                .body(payload)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/flows")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/flows/1"));
    }

    @Test
    @Order(3)
    void end_to_end_verify_versions() {
        given()
                .when().get("/calm/namespaces/finos/flows/1/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo("1.0.0"));
    }

    @Test
    @Order(4)
    void end_to_end_verify_flow() {
        given()
                .when().get("/calm/namespaces/finos/flows/1/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(equalTo(FLOW));
    }

    @Test
    @Order(5)
    void end_to_end_verify_latest_flow() {
        given()
                .body(FLOW_V2)
                .header("Content-Type", "application/json")
                .when().post("/calm/namespaces/finos/flows/1/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("calm/namespaces/finos/flows/1/versions/2.0.0"));

        given()
                .when().get("/calm/namespaces/finos/flows/1")
                .then()
                .statusCode(200)
                .body(equalTo(FLOW_V2));
    }
}
