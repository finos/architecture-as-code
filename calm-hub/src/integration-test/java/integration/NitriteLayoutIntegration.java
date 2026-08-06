package integration;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.*;

import java.util.List;

import static io.restassured.RestAssured.given;
import static integration.performance.ConcurrencyTestHelper.extractIdsFromLocations;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;

/**
 * Runs in its own namespace ({@link #NAMESPACE}) rather than {@code finos}, and allocates its
 * architecture id through the API rather than assuming one. {@code NitriteEndToEndResource} is
 * not {@code restrictToAnnotatedClass}, so every {@code Nitrite*Integration} class shares the
 * same embedded database — {@code NitriteArchitectureIntegration} asserts {@code finos} has no
 * architectures at all, so a shared namespace or a hardcoded id is not safe here. See
 * {@code MongoLayoutIntegration} for the Mongo counterpart of the same pattern.
 */
@QuarkusTest
@TestProfile(NitriteIntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class NitriteLayoutIntegration {

    private static final String NAMESPACE = "layout";

    private static int architectureId;

    private static String validLayout(int architectureId) {
        return """
                {
                    "for": "/api/calm/namespaces/%s/architectures/%d",
                    "name": "Default",
                    "pins": [
                        { "unique-id": "node-a", "position": { "x": 0, "y": 0 } }
                    ]
                }
                """.formatted(NAMESPACE, architectureId);
    }

    private static String updatedLayout(int architectureId) {
        return """
                {
                    "for": "/api/calm/namespaces/%s/architectures/%d",
                    "name": "Default",
                    "pins": [
                        { "unique-id": "node-a", "position": { "x": 100, "y": 200 } }
                    ]
                }
                """.formatted(NAMESPACE, architectureId);
    }

    @BeforeEach
    public void setup() {
        NitriteSetup.namespaceSetup(NAMESPACE, "layout test namespace");

        if (architectureId == 0) {
            architectureId = createArchitecture();
        }
    }

    private static int createArchitecture() {
        Response response = given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                            "name": "layout-test-architecture",
                            "description": "for layout integration tests",
                            "architectureJson": "{}"
                        }
                        """)
                .when().post("/api/calm/namespaces/" + NAMESPACE + "/architectures")
                .thenReturn();
        assertThat(response.getStatusCode(), is(201));
        return extractIdsFromLocations(List.of(response), "architectures/(\\d+)").get(0);
    }

    @Test
    @Order(1)
    void end_to_end_get_with_no_layout_saved() {
        given()
                .when().get("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(404)
                .body(containsString("No default layout saved for architecture " + architectureId + " in namespace: " + NAMESPACE));
    }

    @Test
    @Order(2)
    void end_to_end_reject_a_layout_for_an_architecture_that_does_not_exist() {
        int missingArchitectureId = 999999;

        given()
                .contentType(ContentType.JSON)
                .body(validLayout(missingArchitectureId))
                .when().put("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + missingArchitectureId + "/layout")
                .then()
                .statusCode(404)
                .body(containsString("Architecture " + missingArchitectureId + " does not exist in namespace: " + NAMESPACE));
    }

    @Test
    @Order(3)
    void end_to_end_save_a_layout() {
        given()
                .contentType(ContentType.JSON)
                .body(validLayout(architectureId))
                .when().put("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(204);

        given()
                .when().get("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(200)
                .body("name", equalTo("Default"))
                .body("pins[0].position.x", equalTo(0));
    }

    @Test
    @Order(4)
    void end_to_end_save_is_idempotent_and_overwrites_in_place() {
        given()
                .contentType(ContentType.JSON)
                .body(updatedLayout(architectureId))
                .when().put("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(204);

        given()
                .when().get("/api/calm/namespaces/" + NAMESPACE + "/architectures/" + architectureId + "/layout")
                .then()
                .statusCode(200)
                .body("pins[0].position.x", equalTo(100))
                .body("pins[0].position.y", equalTo(200))
                .body("pins.size()", equalTo(1));
    }
}
