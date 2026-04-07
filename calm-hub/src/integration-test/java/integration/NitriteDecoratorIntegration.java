package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteDecoratorIntegration {

    private static final String VALID_DECORATOR = """
            {
                "unique-id": "finos-architecture-1-deployment",
                "type": "deployment",
                "target": ["/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "target-type": ["architecture"],
                "applies-to": ["example-node"],
                "data": {
                    "start-time": "2026-02-23T10:00:00Z",
                    "status": "in-progress",
                    "notes": "Integration test decorator"
                }
            }
            """;

    private static final String UPDATED_DECORATOR = """
            {
                "unique-id": "finos-architecture-1-deployment",
                "type": "deployment",
                "target": ["/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "target-type": ["architecture"],
                "applies-to": ["example-node"],
                "data": {
                    "start-time": "2026-02-23T10:00:00Z",
                    "status": "completed",
                    "notes": "Integration test decorator"
                }
            }
            """;

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup();
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_decorators() {
        given()
                .when().get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body("values", empty());
    }

    @Test
    @Order(2)
    void end_to_end_create_a_decorator() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR)
                .when().post("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/decorators/1"))
                .body("id", equalTo(1));
    }

    @Test
    @Order(3)
    void end_to_end_list_decorators_contains_created_id() {
        given()
                .when().get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0]", equalTo(1));
    }

    @Test
    @Order(4)
    void end_to_end_retrieve_decorator_by_id() {
        given()
                .when().get("/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200)
                .body("type", equalTo("deployment"))
                .body("uniqueId", equalTo("finos-architecture-1-deployment"))
                .body("target[0]", equalTo("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .body("targetType[0]", equalTo("architecture"))
                .body("appliesTo[0]", equalTo("example-node"));
    }

    @Test
    @Order(5)
    void end_to_end_update_decorator_by_id() {
        given()
                .when().get("/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200)
                .body("data.status", equalTo("in-progress"));

        given()
                .contentType(ContentType.JSON)
                .body(UPDATED_DECORATOR)
                .when().put("/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200);

        given()
                .when().get("/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200)
                .body("data.status", equalTo("completed"));
    }

    @Test
    @Order(6)
    void end_to_end_retrieve_nonexistent_decorator_returns_404() {
        given()
                .when().get("/calm/namespaces/finos/decorators/999")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 999 does not exist in namespace: finos"));
    }
}
